import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { sendJobAssignmentEmail, sendNewMessageEmail } from './email.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const databaseUrl = process.env.DATABASE_URL || 'file:./data/timecard.sqlite';
if (!databaseUrl.startsWith('file:')) throw new Error('DATABASE_URL must be a file: URL for the SQLite adapter.');
const databasePath = path.resolve(root, databaseUrl.slice('file:'.length));
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Admin', 'Cleaner')),
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    address TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Pending'
      CHECK(status IN ('Pending', 'In Progress', 'Completed')),
    cleaner_email TEXT NOT NULL REFERENCES users(email), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), cleaner_email TEXT NOT NULL REFERENCES users(email),
    clock_in TEXT NOT NULL, clock_out TEXT, hours REAL
  );
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), cleaner_email TEXT NOT NULL REFERENCES users(email),
    type TEXT NOT NULL CHECK(type IN ('Before', 'After')), photo TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, notes TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, sender_email TEXT NOT NULL REFERENCES users(email), receiver_email TEXT NOT NULL REFERENCES users(email),
    job_id TEXT REFERENCES jobs(id), content TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(sender_email, receiver_email, timestamp);
  CREATE INDEX IF NOT EXISTS time_entries_cleaner_idx ON time_entries(cleaner_email, clock_in);
`);

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (!userCount) {
  const insertUser = db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)');
  const password = bcrypt.hashSync('welcome123', 10);
  insertUser.run('primordialud@gmail.com', 'Morgan Lee', 'Admin', password);
  insertUser.run('your@email.com', 'Morgan Lee', 'Admin', password);
  insertUser.run('cleaner@email.com', 'Jamie Chen', 'Cleaner', password);
  insertUser.run('alex@timecard.local', 'Alex Rivera', 'Cleaner', password);
  const date = (offset) => {
    const value = new Date();
    value.setDate(value.getDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const insertJob = db.prepare('INSERT INTO jobs (id, date, start_time, end_time, address, instructions, status, cleaner_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertJob.run('J001', date(0), '08:00', '11:00', '1428 Pine Street, Portland', 'Use the side entrance. Focus on the kitchen and living room windows.', 'In Progress', 'cleaner@email.com');
  insertJob.run('J002', date(0), '12:30', '15:00', '86 Willow Lane, Portland', 'Fresh linens are in the hall closet. Please lock the back door.', 'Pending', 'cleaner@email.com');
  insertJob.run('J003', date(1), '09:00', '12:00', '501 NE Alberta St, Portland', 'Pet-friendly products only. A golden retriever will be home.', 'Pending', 'alex@timecard.local');
  insertJob.run('J004', date(-1), '10:00', '13:00', '2207 SE Belmont St, Portland', 'Monthly deep clean; supplies are under the utility sink.', 'Completed', 'alex@timecard.local');
}
if (!db.prepare("SELECT id FROM time_entries WHERE job_id = 'J001' AND clock_out IS NULL").get()) {
  const firstJob = db.prepare("SELECT date, start_time, cleaner_email FROM jobs WHERE id = 'J001' AND status = 'In Progress'").get();
  if (firstJob) {
    const clockIn = new Date(`${firstJob.date}T${firstJob.start_time}:00`).toISOString();
    db.prepare('INSERT INTO time_entries (id, job_id, cleaner_email, clock_in) VALUES (?, ?, ?, ?)').run(randomUUID(), 'J001', firstJob.cleaner_email, clockIn);
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'timecard-local-development-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
});
app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware);
app.use('/uploads', express.static(uploadDir));
io.engine.use(sessionMiddleware);

const ADMIN_EMAIL = 'primordialud@gmail.com';
const publicUser = (user) => ({ email: user.email, name: user.name, role: user.role });
const requireAuth = (req, res, next) => req.session.user ? next() : res.status(401).json({ error: 'Sign in to continue.' });
const requireAdmin = (req, res, next) => req.session.user?.role === 'Admin' ? next() : res.status(403).json({ error: 'Admin access required.' });
const jobForUser = (jobId, user) => db.prepare('SELECT * FROM jobs WHERE id = ? AND (? = \'Admin\' OR cleaner_email = ?)').get(jobId, user.role, user.email);
const jobShape = (job) => ({ ...job, cleanerEmail: job.cleaner_email, startTime: job.start_time, endTime: job.end_time });
const timeShape = (entry) => ({ ...entry, jobId: entry.job_id, cleanerEmail: entry.cleaner_email, clockIn: entry.clock_in, clockOut: entry.clock_out });
const photoShape = (photo) => ({ ...photo, jobId: photo.job_id, cleanerEmail: photo.cleaner_email });
const messageShape = (message) => ({ ...message, messageId: message.id, senderEmail: message.sender_email, receiverEmail: message.receiver_email, jobId: message.job_id, timestamp: message.timestamp });

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.user = publicUser(user);
  res.json({ user: req.session.user });
});
app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedPassword = String(password || '');

  if (!trimmedName || !trimmedEmail || !trimmedPassword) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (trimmedPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  if (db.prepare('SELECT email FROM users WHERE email = ?').get(trimmedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const role = trimmedEmail === ADMIN_EMAIL ? 'Admin' : 'Cleaner';
  const passwordHash = bcrypt.hashSync(trimmedPassword, 10);
  db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)')
    .run(trimmedEmail, trimmedName, role, passwordHash);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(trimmedEmail);
  req.session.user = publicUser(user);
  res.status(201).json({ user: req.session.user, role });
});
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/users', requireAuth, (req, res) => {
  const users = req.session.user.role === 'Admin'
    ? db.prepare('SELECT email, name, role FROM users ORDER BY role, name').all()
    : db.prepare("SELECT email, name, role FROM users WHERE role = 'Admin' ORDER BY name").all();
  res.json(users);
});
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { email, name, role = 'Cleaner', password = 'welcome123' } = req.body || {};
  if (!email || !name || !['Cleaner', 'Admin'].includes(role)) return res.status(400).json({ error: 'Name, email, and a valid role are required.' });
  try {
    db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)').run(email.trim().toLowerCase(), name.trim(), role, bcrypt.hashSync(password, 10));
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())));
  } catch {
    res.status(409).json({ error: 'A user with that email already exists.' });
  }
});
app.delete('/api/users/:email', requireAuth, requireAdmin, (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const user = db.prepare("SELECT email, role FROM users WHERE email = ?").get(email);
  if (!user || user.role !== 'Cleaner') return res.status(404).json({ error: 'Cleaner not found.' });

  const relatedRecords = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM jobs WHERE cleaner_email = @email) +
      (SELECT COUNT(*) FROM time_entries WHERE cleaner_email = @email) +
      (SELECT COUNT(*) FROM photos WHERE cleaner_email = @email) +
      (SELECT COUNT(*) FROM messages WHERE sender_email = @email OR receiver_email = @email) AS count
  `).get({ email }).count;
  if (relatedRecords) {
    return res.status(409).json({ error: 'This cleaner has jobs, time entries, photos, or messages. Remove those records before deleting the team member.' });
  }

  db.prepare('DELETE FROM users WHERE email = ?').run(email);
  res.status(204).end();
});

app.get('/api/jobs', requireAuth, (req, res) => {
  const rows = req.session.user.role === 'Admin'
    ? db.prepare('SELECT jobs.*, users.name AS cleaner_name FROM jobs JOIN users ON users.email = jobs.cleaner_email ORDER BY date, start_time').all()
    : db.prepare('SELECT jobs.*, users.name AS cleaner_name FROM jobs JOIN users ON users.email = jobs.cleaner_email WHERE cleaner_email = ? ORDER BY date, start_time').all(req.session.user.email);
  res.json(rows.map(jobShape));
});
app.post('/api/jobs', requireAuth, requireAdmin, async (req, res) => {
  const { date, startTime, endTime, address, instructions = '', cleanerEmail } = req.body || {};
  if (!date || !startTime || !endTime || !address || !cleanerEmail) return res.status(400).json({ error: 'Date, times, address, and cleaner are required.' });
  const cleaner = db.prepare("SELECT email, name FROM users WHERE email = ? AND role = 'Cleaner'").get(cleanerEmail);
  if (!cleaner) return res.status(400).json({ error: 'Choose a valid cleaner.' });
  const id = `J${randomUUID().slice(0, 6).toUpperCase()}`;
  db.prepare('INSERT INTO jobs (id, date, start_time, end_time, address, instructions, cleaner_email) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, date, startTime, endTime, address, instructions, cleanerEmail);
  const job = db.prepare('SELECT jobs.*, users.name AS cleaner_name FROM jobs JOIN users ON users.email = jobs.cleaner_email WHERE id = ?').get(id);
  const emailNotification = await sendJobAssignmentEmail(job, cleaner).catch((error) => {
    console.error('Failed to send job assignment email:', error);
    return { status: 'failed' };
  });
  res.status(201).json({ ...jobShape(job), emailNotification });
});
app.put('/api/jobs/:id', requireAuth, requireAdmin, async (req, res) => {
  const { date, startTime, endTime, address, instructions = '', cleanerEmail } = req.body || {};
  if (!date || !startTime || !endTime || !address || !cleanerEmail) return res.status(400).json({ error: 'Date, times, address, and cleaner are required.' });
  const cleaner = db.prepare("SELECT email, name FROM users WHERE email = ? AND role = 'Cleaner'").get(cleanerEmail);
  if (!cleaner) return res.status(400).json({ error: 'Choose a valid cleaner.' });
  const previousJob = db.prepare('SELECT cleaner_email FROM jobs WHERE id = ?').get(req.params.id);
  const result = db.prepare('UPDATE jobs SET date = ?, start_time = ?, end_time = ?, address = ?, instructions = ?, cleaner_email = ? WHERE id = ?').run(date, startTime, endTime, address, instructions, cleanerEmail, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Job not found.' });
  const job = db.prepare('SELECT jobs.*, users.name AS cleaner_name FROM jobs JOIN users ON users.email = jobs.cleaner_email WHERE id = ?').get(req.params.id);
  const emailNotification = previousJob.cleaner_email !== cleanerEmail
    ? await sendJobAssignmentEmail(job, cleaner).catch((error) => {
      console.error('Failed to send job assignment email:', error);
      return { status: 'failed' };
    })
    : null;
  res.json({ ...jobShape(job), ...(emailNotification && { emailNotification }) });
});
app.delete('/api/jobs/:id', requireAuth, requireAdmin, (req, res) => {
  const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  const relatedRecords = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM time_entries WHERE job_id = @id) +
      (SELECT COUNT(*) FROM photos WHERE job_id = @id) +
      (SELECT COUNT(*) FROM messages WHERE job_id = @id) AS count
  `).get({ id: job.id }).count;
  if (relatedRecords) {
    return res.status(409).json({ error: 'This job has linked time entries, photos, or messages. Remove those records before deleting the job.' });
  }

  db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
  res.status(204).end();
});
app.patch('/api/jobs/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const job = jobForUser(req.params.id, req.session.user);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (!['In Progress', 'Completed'].includes(status)) return res.status(400).json({ error: 'Invalid job status.' });
  if (req.session.user.role === 'Cleaner' && status === 'In Progress') {
    const active = db.prepare('SELECT id FROM time_entries WHERE job_id = ? AND cleaner_email = ? AND clock_out IS NULL').get(job.id, req.session.user.email);
    if (!active) return res.status(409).json({ error: 'Clock in before starting this job.' });
  }
  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, job.id);
  res.json({ ...jobShape(db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id)), status });
});

app.get('/api/time', requireAuth, (req, res) => {
  const rows = req.session.user.role === 'Admin'
    ? db.prepare('SELECT time_entries.*, jobs.address, users.name AS cleaner_name FROM time_entries JOIN jobs ON jobs.id = time_entries.job_id JOIN users ON users.email = time_entries.cleaner_email ORDER BY clock_in DESC').all()
    : db.prepare('SELECT time_entries.*, jobs.address, users.name AS cleaner_name FROM time_entries JOIN jobs ON jobs.id = time_entries.job_id JOIN users ON users.email = time_entries.cleaner_email WHERE time_entries.cleaner_email = ? ORDER BY clock_in DESC').all(req.session.user.email);
  res.json(rows.map(timeShape));
});
app.post('/api/jobs/:id/clock-in', requireAuth, (req, res) => {
  if (req.session.user.role !== 'Cleaner') return res.status(403).json({ error: 'Only cleaners can clock in.' });
  const job = jobForUser(req.params.id, req.session.user);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (db.prepare('SELECT id FROM time_entries WHERE cleaner_email = ? AND clock_out IS NULL').get(req.session.user.email)) return res.status(409).json({ error: 'Clock out of your active job first.' });
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO time_entries (id, job_id, cleaner_email, clock_in) VALUES (?, ?, ?, ?)').run(id, job.id, req.session.user.email, now);
  db.prepare("UPDATE jobs SET status = 'In Progress' WHERE id = ?").run(job.id);
  res.status(201).json(timeShape(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id)));
});
app.post('/api/jobs/:id/clock-out', requireAuth, (req, res) => {
  if (req.session.user.role !== 'Cleaner') return res.status(403).json({ error: 'Only cleaners can clock out.' });
  const entry = db.prepare('SELECT * FROM time_entries WHERE job_id = ? AND cleaner_email = ? AND clock_out IS NULL').get(req.params.id, req.session.user.email);
  if (!entry) return res.status(404).json({ error: 'No active time entry found for this job.' });
  const clockOut = new Date();
  const hours = Math.round(((clockOut.getTime() - new Date(entry.clock_in).getTime()) / 3600000) * 100) / 100;
  db.prepare('UPDATE time_entries SET clock_out = ?, hours = ? WHERE id = ?').run(clockOut.toISOString(), hours, entry.id);
  const openEntries = db.prepare('SELECT id FROM time_entries WHERE job_id = ? AND clock_out IS NULL').get(entry.job_id);
  if (!openEntries) db.prepare("UPDATE jobs SET status = 'Completed' WHERE id = ?").run(entry.job_id);
  res.json(timeShape(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entry.id)));
});

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.mimetype)),
});
app.get('/api/photos', requireAuth, (req, res) => {
  const rows = req.session.user.role === 'Admin'
    ? db.prepare('SELECT photos.*, jobs.address, users.name AS cleaner_name FROM photos JOIN jobs ON jobs.id = photos.job_id JOIN users ON users.email = photos.cleaner_email ORDER BY timestamp DESC').all()
    : db.prepare('SELECT photos.*, jobs.address, users.name AS cleaner_name FROM photos JOIN jobs ON jobs.id = photos.job_id JOIN users ON users.email = photos.cleaner_email WHERE photos.cleaner_email = ? ORDER BY timestamp DESC').all(req.session.user.email);
  res.json(rows.map(photoShape));
});
app.post('/api/jobs/:id/photos', requireAuth, upload.single('photo'), (req, res) => {
  const job = jobForUser(req.params.id, req.session.user);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (!req.file) return res.status(400).json({ error: 'Choose an image up to 8 MB.' });
  const type = req.body.type;
  if (!['Before', 'After'].includes(type)) return res.status(400).json({ error: 'Photo type must be Before or After.' });
  const id = randomUUID();
  db.prepare('INSERT INTO photos (id, job_id, cleaner_email, type, photo, notes) VALUES (?, ?, ?, ?, ?, ?)').run(id, job.id, req.session.user.email, type, `/uploads/${req.file.filename}`, req.body.notes || '');
  res.status(201).json(photoShape(db.prepare('SELECT * FROM photos WHERE id = ?').get(id)));
});

app.get('/api/contacts', requireAuth, (req, res) => {
  const users = req.session.user.role === 'Admin'
    ? db.prepare("SELECT email, name, role FROM users WHERE role = 'Cleaner' ORDER BY name").all()
    : db.prepare("SELECT email, name, role FROM users WHERE role = 'Admin' ORDER BY name LIMIT 1").all();
  res.json(users.map((user) => {
    const last = db.prepare('SELECT content, timestamp FROM messages WHERE (sender_email = ? AND receiver_email = ?) OR (sender_email = ? AND receiver_email = ?) ORDER BY timestamp DESC LIMIT 1').get(req.session.user.email, user.email, user.email, req.session.user.email);
    return { ...user, lastMessage: last?.content || '', lastMessageAt: last?.timestamp || null };
  }));
});
app.get('/api/messages', requireAuth, (req, res) => {
  const peer = String(req.query.peer || '');
  if (!db.prepare('SELECT email FROM users WHERE email = ?').get(peer) || peer === req.session.user.email) return res.status(400).json({ error: 'Choose a valid conversation.' });
  const rows = db.prepare(`SELECT * FROM messages WHERE ((sender_email = ? AND receiver_email = ?) OR (sender_email = ? AND receiver_email = ?)) AND (job_id IS ? OR ? IS NULL) ORDER BY timestamp`).all(req.session.user.email, peer, peer, req.session.user.email, req.query.jobId || null, req.query.jobId || null);
  res.json(rows.map(messageShape));
});
app.post('/api/messages', requireAuth, async (req, res) => {
  const { receiverEmail, jobId = null, content } = req.body || {};
  const receiver = db.prepare('SELECT * FROM users WHERE email = ?').get(String(receiverEmail || ''));
  if (!receiver || receiver.email === req.session.user.email) return res.status(400).json({ error: 'Choose a valid recipient.' });
  if (req.session.user.role === 'Cleaner' && receiver.role !== 'Admin') return res.status(403).json({ error: 'Cleaners can message an admin only.' });
  if (!String(content || '').trim()) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (jobId && !jobForUser(jobId, req.session.user)) return res.status(404).json({ error: 'Job not found.' });
  const message = { id: randomUUID(), sender_email: req.session.user.email, receiver_email: receiver.email, job_id: jobId, content: String(content).trim().slice(0, 4000), timestamp: new Date().toISOString() };
  db.prepare('INSERT INTO messages (id, sender_email, receiver_email, job_id, content, timestamp) VALUES (@id, @sender_email, @receiver_email, @job_id, @content, @timestamp)').run(message);
  const shaped = messageShape(message);
  io.to(`user:${message.sender_email}`).to(`user:${message.receiver_email}`).emit('message:new', shaped);
  const sender = db.prepare('SELECT name FROM users WHERE email = ?').get(message.sender_email);
  const emailNotification = await sendNewMessageEmail(receiver, sender, message.content).catch((error) => {
    console.error('Failed to send new-message email:', error);
    return { status: 'failed' };
  });
  res.status(201).json({ ...shaped, emailNotification });
});

io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
io.on('connection', (socket) => {
  const user = socket.request.session?.user;
  if (user) socket.join(`user:${user.email}`);
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const clientDir = path.resolve(root, '../dist');
const clientIndex = path.join(clientDir, 'index.html');
app.get('/', (_req, res, next) => {
  res.sendFile(clientIndex, (error) => {
    if (error) next(error);
  });
});
app.use(express.static(clientDir));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
  if (fs.existsSync(clientIndex)) return res.sendFile(clientIndex);
  next();
});

const port = Number(process.env.PORT || 3000);
httpServer.listen(port, '0.0.0.0', () => console.log(`TimeCard API listening on http://localhost:${port}`));
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowDownLeft, ArrowRight, CalendarDays, Camera, Check, CheckCheck, ChevronDown,
  Clock3, FileClock, House, LogOut, MapPin, Menu, MessageCircle, Paperclip,
  Pencil, Plus, Send, ShieldCheck, Sparkles, Users, X,
} from 'lucide-react';
import './styles.css';

const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'include', ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'Something went wrong.');
  return body;
};

const formatDate = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', options) : '—';
const formatTime = (time) => time ? new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';
const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Login({ onLogin }) {
  const [email, setEmail] = useState('your@email.com');
  const [password, setPassword] = useState('welcome123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="brand brand-light"><span className="brand-mark"><Clock3 size={17} /></span><span>timecard</span></div>
        <div className="story-copy">
          <span className="eyebrow"><span className="live-dot" /> FIELD OPERATIONS</span>
          <h1>Good work.<br /><em>Well accounted for.</em></h1>
          <p>A calmer way to keep every clean, every hour, and every conversation in one place.</p>
        </div>
        <div className="story-foot"><span>PORTLAND, OR</span><span>EST. 2024</span></div>
        <div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" />
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand brand"><span className="brand-mark"><Clock3 size={17} /></span><span>timecard</span></div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Your team’s day, all in good order.</p>
          <form onSubmit={submit} className="login-form">
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-dark button-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          <div className="demo-access">
            <span className="eyebrow">DEMO ACCESS</span>
            <button type="button" className="demo-choice" onClick={() => { setEmail('your@email.com'); setPassword('welcome123'); }}><span className="demo-icon"><ShieldCheck size={16} /></span><span><strong>Manager</strong><small>your@email.com</small></span><ArrowRight size={15} /></button>
            <button type="button" className="demo-choice" onClick={() => { setEmail('cleaner@email.com'); setPassword('welcome123'); }}><span className="demo-icon demo-icon-green"><Sparkles size={16} /></span><span><strong>Cleaner</strong><small>cleaner@email.com</small></span><ArrowRight size={15} /></button>
            <small className="demo-password">Both accounts use <b>welcome123</b></small>
          </div>
        </div>
        <span className="login-copyright">© 2026 TIMECARD STUDIO</span>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('Overview');
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [photos, setPhotos] = useState([]);
        content = <Team users={users} jobs={jobs} onAdd={() => setModal({ type: 'user' })} onMessage={(email) => { setChatPeer(email); setPage('Messages'); }} />;
  const [modal, setModal] = useState(null);
  const [chatPeer, setChatPeer] = useState('');
  const [chatJob, setChatJob] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  async function loadWorkspace() {
    const [jobRows, userRows, timeRows, photoRows, contactRows] = await Promise.all([
      api('/api/jobs'), api('/api/users'), api('/api/time'), api('/api/photos'), api('/api/contacts'),
    ]);
    setJobs(jobRows);
    setUsers(userRows);
    setTimeEntries(timeRows);
    setPhotos(photoRows);
    setContacts(contactRows);
  }

  useEffect(() => {
    api('/api/auth/me').then(({ user: current }) => {
      if (current) setUser(current);
    }).catch(() => {}).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (user) loadWorkspace().catch((err) => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function refresh() {
    try {
      await loadWorkspace();
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setJobs([]);
    setPage('Overview');
  }

  async function clock(job, isClockedIn) {
    try {
      await api(`/api/jobs/${job.id}/${isClockedIn ? 'clock-out' : 'clock-in'}`, { method: 'POST' });
      await refresh();
      setNotice(isClockedIn ? 'Shift saved. Nice work.' : `Clocked in at ${job.address.split(',')[0]}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ready) return <div className="loading-screen"><span className="brand-mark"><Clock3 size={17} /></span></div>;
  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === 'Admin';
  const navItems = isAdmin
    ? [{ label: 'Overview', icon: House }, { label: 'Schedule', icon: CalendarDays }, { label: 'Time cards', icon: FileClock }, { label: 'Photos', icon: Camera }, { label: 'Team', icon: Users }, { label: 'Messages', icon: MessageCircle }]
    : [{ label: 'My day', icon: House }, { label: 'Time cards', icon: FileClock }, { label: 'Photos', icon: Camera }, { label: 'Messages', icon: MessageCircle }];
  const displayPage = page === 'Overview' && !isAdmin ? 'My day' : page;
  const activeEntry = timeEntries.find((entry) => !entry.clockOut);
  const today = new Date().toISOString().slice(0, 10);
  const todaysJobs = jobs.filter((job) => job.date === today);
  const completedCount = jobs.filter((job) => job.status === 'Completed').length;
  const hoursTotal = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let content;
  if (displayPage === 'Overview' || displayPage === 'My day') {
    content = isAdmin
      ? <Overview user={user} jobs={jobs} timeEntries={timeEntries} photos={photos} contacts={contacts} todayJobs={todaysJobs} onNavigate={setPage} onNewJob={() => setModal({ type: 'job' })} onMessage={() => setPage('Messages')} />
      : <CleanerDay user={user} jobs={jobs} timeEntries={timeEntries} activeEntry={activeEntry} onClock={clock} onUpload={(job) => setModal({ type: 'photo', job })} />;
  } else if (displayPage === 'Schedule') {
    content = <Schedule jobs={jobs} onNewJob={() => setModal({ type: 'job' })} onEdit={(job) => setModal({ type: 'job', job })} onMessage={(job) => { setChatPeer(job.cleanerEmail); setChatJob(job.id); setPage('Messages'); }} />;
  } else if (displayPage === 'Time cards') {
    content = <TimeCards entries={timeEntries} isAdmin={isAdmin} hoursTotal={hoursTotal} />;
  } else if (displayPage === 'Photos') {
    content = <PhotoGallery photos={photos} jobs={jobs} isAdmin={isAdmin} onUpload={(job) => setModal({ type: 'photo', job })} />;
  } else if (displayPage === 'Team') {
    content = <Team users={users} jobs={jobs} onAdd={() => setModal({ type: 'user' })} onMessage={() => setPage('Messages')} />;
  } else {
    content = <Chat user={user} contacts={contacts} jobs={jobs} initialPeer={chatPeer} initialJob={chatJob} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand brand-light sidebar-brand"><span className="brand-mark"><Clock3 size={17} /></span><span>timecard</span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">H</span><span><b>Household Co.</b><small>Operations</small></span><ChevronDown size={14} /></div>
        <span className="nav-caption">WORKSPACE</span>
        <nav className="main-nav">
          {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${displayPage === label ? 'nav-link-active' : ''}`} onClick={() => { setPage(label); setMobileNav(false); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Messages' && contacts.some((contact) => contact.lastMessage) && <i className="nav-indicator" />}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="help-card"><span className="help-spark"><Sparkles size={15} /></span><b>All caught up?</b><span>Take a moment to reset.</span><div className="help-line"><i /></div></div>
        <div className="sidebar-user"><span className="avatar avatar-mint">{initials(user.name)}</span><span className="sidebar-user-meta"><b>{user.name}</b><small>{isAdmin ? 'Workspace manager' : 'Cleaning team'}</small></span><button className="icon-button sidebar-logout" title="Sign out" onClick={signOut}><LogOut size={16} /></button></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button><div className="breadcrumb">Workspace <span>/</span> <b>{displayPage}</b></div><div className="topbar-right"><span className="today-label"><span className="live-dot" />{todayName}</span><button className="topbar-avatar" title={user.name}>{initials(user.name)}</button></div></header>
        <div className="page-content">
          {error && <div className="alert alert-error"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
          {content}
        </div>
      </main>
      {notice && <div className="toast"><Check size={16} />{notice}</div>}
      {modal?.type === 'job' && <JobModal key={modal.job?.id || 'new-job'} users={users} job={modal.job} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await refresh(); setNotice(modal.job ? 'Job details updated.' : 'Job added to the schedule.'); }} />}
      {modal?.type === 'photo' && <PhotoModal job={modal.job} jobs={jobs} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await refresh(); setNotice('Photo added to the job.'); }} />}
      {modal?.type === 'user' && <UserModal onClose={() => setModal(null)} onSaved={async () => { setModal(null); await refresh(); setNotice('Team member added.'); }} />}
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    </div>
  );
}

function PageHeading({ eyebrow, title, detail, action }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function Overview({ user, jobs, timeEntries, photos, contacts, todayJobs, onNavigate, onNewJob, onMessage }) {
  const inProgress = jobs.filter((job) => job.status === 'In Progress').length;
  const hours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  return <>
    <PageHeading eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} title={`Good morning, ${user.name.split(' ')[0]}.`} detail="Here’s the shape of your team’s day." action={<button className="button button-dark" onClick={onNewJob}><Plus size={16} /> Schedule a job</button>} />
    <section className="metric-grid">
      <Metric label="Today’s jobs" value={todayJobs.length.toString().padStart(2, '0')} foot={`${jobs.filter((job) => job.status === 'Pending').length} awaiting start`} icon={CalendarDays} tone="mint" />
      <Metric label="On the clock" value={inProgress.toString().padStart(2, '0')} foot={inProgress ? 'Active right now' : 'No active shifts'} icon={Clock3} tone="peach" />
      <Metric label="Hours logged" value={`${hours.toFixed(1)}h`} foot="Across all time cards" icon={FileClock} tone="blue" />
      <Metric label="Finished jobs" value={jobs.filter((job) => job.status === 'Completed').length.toString().padStart(2, '0')} foot="All time" icon={CheckCheck} tone="yellow" />
    </section>
    <div className="overview-grid">
      <section className="surface schedule-surface">
        <div className="section-head"><div><span className="eyebrow">FIELD SCHEDULE</span><h2>Today, in motion</h2></div><button className="text-button" onClick={() => onNavigate('Schedule')}>Full schedule <ArrowRight size={14} /></button></div>
        {todayJobs.length ? <div className="schedule-list">{todayJobs.map((job, index) => <JobScheduleRow key={job.id} job={job} index={index} />)}</div> : <EmptyState icon={CalendarDays} title="A little breathing room" detail="There are no jobs on the schedule today." />}
      </section>
      <section className="surface team-pulse">
        <div className="section-head"><div><span className="eyebrow">TEAM PULSE</span><h2>People at work</h2></div><button className="icon-button" onClick={() => onNavigate('Team')} aria-label="View team"><ArrowRight size={16} /></button></div>
        {jobs.filter((job) => job.status === 'In Progress').length ? jobs.filter((job) => job.status === 'In Progress').map((job) => <div className="pulse-person" key={job.id}><span className="avatar avatar-peach">{initials(job.cleaner_name)}</span><span className="pulse-meta"><b>{job.cleaner_name}</b><small>{job.address.split(',')[0]}</small></span><span className="status-pill status-progress"><i />On site</span></div>) : <div className="pulse-empty"><span className="pulse-illustration"><Users size={24} /></span><b>The team is between jobs</b><small>Active shifts appear here.</small></div>}
        <button className="outline-button pulse-cta" onClick={onNavigate.bind(null, 'Team')}>View all team members <ArrowRight size={14} /></button>
      </section>
    </div>
    <div className="overview-bottom">
      <section className="surface compact-surface"><div className="section-head"><div><span className="eyebrow">RECENT PHOTOS</span><h2>Latest from the field</h2></div><button className="text-button" onClick={() => onNavigate('Photos')}>View gallery <ArrowRight size={14} /></button></div>
        {photos.length ? <div className="mini-photo-row">{photos.slice(0, 3).map((photo) => <button className="mini-photo" key={photo.id} onClick={() => onNavigate('Photos')}><img src={photo.photo} alt={`${photo.type} at ${photo.address}`} /><span>{photo.type}</span></button>)}</div> : <p className="quiet-copy">Job photos will show up here as the team shares them.</p>}
      </section>
      <section className="surface message-preview"><div className="section-head"><div><span className="eyebrow">INBOX</span><h2>Team messages</h2></div><button className="icon-button" onClick={onMessage} aria-label="Open messages"><ArrowRight size={16} /></button></div>
        {contacts.length ? contacts.slice(0, 2).map((contact) => <button className="inbox-row" key={contact.email} onClick={onMessage}><span className="avatar avatar-blue">{initials(contact.name)}</span><span><b>{contact.name}</b><small>{contact.lastMessage || 'Start a conversation'}</small></span>{contact.lastMessageAt && <small className="inbox-time">{formatTime(contact.lastMessageAt)}</small>}</button>) : <p className="quiet-copy">Add a teammate to start a conversation.</p>}
      </section>
    </div>
  </>;
}

function Metric({ label, value, foot, icon: Icon, tone }) {
  return <div className="metric-card"><span className={`metric-icon tone-${tone}`}><Icon size={17} strokeWidth={1.8} /></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{foot}</small><span className={`metric-mark mark-${tone}`} /></div>;
}

function JobScheduleRow({ job, index = 0 }) {
  return <div className="schedule-row"><div className="schedule-time"><b>{formatClock(job.startTime)}</b><span>{job.endTime}</span></div><div className={`schedule-rail rail-${index % 3}`}><i /></div><div className="schedule-job"><div className="job-topline"><b>{job.address.split(',')[0]}</b><span className={`status-pill status-${job.status.toLowerCase().replace(' ', '-')}`}><i />{job.status}</span></div><span className="job-address"><MapPin size={13} />{job.address}</span><span className="job-assignee"><span className="tiny-avatar">{initials(job.cleaner_name)}</span>{job.cleaner_name}</span></div><span className="job-code">{job.id}</span></div>;
}

function formatClock(value) {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function CleanerDay({ user, jobs, timeEntries, activeEntry, onClock, onUpload }) {
  const date = new Date().toISOString().slice(0, 10);
  const todayJobs = jobs.filter((job) => job.date === date);
  const completed = jobs.filter((job) => job.status === 'Completed').length;
  const hours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  return <>
    <PageHeading eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} title={`Your day, ${user.name.split(' ')[0]}.`} detail="One good clean at a time." action={<span className={`status-pill ${activeEntry ? 'status-progress' : 'status-pending'}`}><i />{activeEntry ? 'Clocked in' : 'Off the clock'}</span>} />
    <section className={`shift-banner ${activeEntry ? 'shift-active' : ''}`}><div className="shift-banner-copy"><span className="eyebrow">{activeEntry ? 'SHIFT IN PROGRESS' : 'YOUR SHIFT, AT A GLANCE'}</span><h2>{activeEntry ? 'You’re on the clock.' : todayJobs.length ? 'Ready when you are.' : 'A clear day ahead.'}</h2><p>{activeEntry ? 'Your time is being tracked. Keep up the great work.' : `${todayJobs.length} ${todayJobs.length === 1 ? 'job' : 'jobs'} on your schedule today.`}</p></div><div className="shift-clock"><span className="clock-face"><Clock3 size={22} /></span><span><b>{hours.toFixed(1)}<small>h</small></b><small>logged this week</small></span></div><span className="shift-curve" /></section>
    <div className="cleaner-stats"><div><span className="stat-number">{todayJobs.length.toString().padStart(2, '0')}</span><span>Scheduled today</span></div><div><span className="stat-number">{completed.toString().padStart(2, '0')}</span><span>Jobs completed</span></div><div><span className="stat-number">{timeEntries.length.toString().padStart(2, '0')}</span><span>Time entries</span></div></div>
    <div className="section-head jobs-heading"><div><span className="eyebrow">ON YOUR ROUTE</span><h2>Today’s jobs <span className="count-dot">{todayJobs.length}</span></h2></div><span className="subtle-date"><CalendarDays size={14} />{formatDate(date, { month: 'long', day: 'numeric' })}</span></div>
    {todayJobs.length ? <div className="cleaner-job-list">{todayJobs.map((job) => <CleanerJob key={job.id} job={job} activeEntry={activeEntry} onClock={onClock} onUpload={onUpload} />)}</div> : <div className="surface no-jobs"><span className="no-jobs-icon"><Sparkles size={22} /></span><h3>No jobs scheduled for today</h3><p>Your next assignment will appear here.</p></div>}
  </>;
}

function CleanerJob({ job, activeEntry, onClock, onUpload }) {
  const isActive = activeEntry?.jobId === job.id;
  const canClock = !activeEntry || isActive;
  return <article className={`cleaner-job ${isActive ? 'cleaner-job-active' : ''}`}><div className="cleaner-job-time"><span>{formatClock(job.startTime)}</span><i /><span>{formatClock(job.endTime)}</span></div><div className="cleaner-job-main"><div className="cleaner-job-heading"><div><span className="eyebrow">{job.id} · {formatDate(job.date)}</span><h3>{job.address.split(',')[0]}</h3><span className="job-address"><MapPin size={14} />{job.address}</span></div><span className={`status-pill status-${job.status.toLowerCase().replace(' ', '-')}`}><i />{job.status}</span></div><p className="job-instructions">{job.instructions || 'No special instructions.'}</p><div className="cleaner-job-actions"><button className={`button ${isActive ? 'button-coral' : 'button-dark'}`} disabled={!canClock || job.status === 'Completed'} onClick={() => onClock(job, isActive)}>{isActive ? <><ArrowDownLeft size={15} />Clock out</> : <><Clock3 size={15} />Clock in</>}</button><button className="outline-button" onClick={() => onUpload(job)}><Camera size={15} />Add job photo</button></div></div><div className="cleaner-job-side"><span className="side-number">{job.id.slice(-3)}</span><span>ASSIGNMENT</span></div></article>;
}

function Schedule({ jobs, onNewJob, onEdit, onMessage }) {
  return <><PageHeading eyebrow="OPERATIONS" title="Schedule" detail="Every visit, assigned and accounted for." action={<button className="button button-dark" onClick={onNewJob}><Plus size={16} /> New job</button>} />
    <div className="schedule-toolbar"><span className="eyebrow">ALL ASSIGNMENTS <b>{jobs.length}</b></span><span className="toolbar-date"><CalendarDays size={15} />Upcoming and recent</span></div>
    <div className="surface table-surface"><table><thead><tr><th>JOB</th><th>DATE & TIME</th><th>ADDRESS</th><th>CLEANER</th><th>STATUS</th><th /></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><span className="table-job-id">{job.id}</span></td><td><b>{formatDate(job.date)}</b><small>{formatClock(job.startTime)} – {formatClock(job.endTime)}</small></td><td><b>{job.address.split(',')[0]}</b><small>{job.address}</small></td><td><span className="table-person"><span className="tiny-avatar">{initials(job.cleaner_name)}</span>{job.cleaner_name}</span></td><td><span className={`status-pill status-${job.status.toLowerCase().replace(' ', '-')}`}><i />{job.status}</span></td><td><button className="icon-button row-message" onClick={() => onEdit(job)} title={`Edit ${job.id}`}><Pencil size={15} /></button><button className="icon-button row-message" onClick={() => onMessage(job)} title={`Message ${job.cleaner_name}`}><MessageCircle size={16} /></button></td></tr>)}</tbody></table>{!jobs.length && <EmptyState icon={CalendarDays} title="The schedule is clear" detail="Create a job to get the team moving." />}</div>
  </>;
}

function TimeCards({ entries, isAdmin, hoursTotal }) {
  return <><PageHeading eyebrow="PAYROLL & HOURS" title={isAdmin ? 'Time cards' : 'Your time cards'} detail={isAdmin ? 'A clear record of every shift across the team.' : 'Your hours, all in one place.'} />
    <section className="time-summary"><div><span className="eyebrow">TOTAL HOURS</span><strong>{hoursTotal.toFixed(2)}<small> hrs</small></strong><span className="summary-note"><span className="live-dot" />{entries.length} recorded {entries.length === 1 ? 'shift' : 'shifts'}</span></div><span className="summary-art"><FileClock size={50} strokeWidth={1.15} /></span></section>
    <div className="section-head time-list-head"><div><span className="eyebrow">SHIFT HISTORY</span><h2>Recent entries</h2></div></div>
    <div className="surface table-surface"><table><thead><tr><th>{isAdmin ? 'TEAM MEMBER' : 'JOB'}</th><th>LOCATION</th><th>CLOCK IN</th><th>CLOCK OUT</th><th>HOURS</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{isAdmin ? <span className="table-person"><span className="tiny-avatar">{initials(entry.cleaner_name)}</span>{entry.cleaner_name}</span> : <span className="table-job-id">{entry.jobId}</span>}</td><td><b>{entry.address}</b></td><td><b>{formatTime(entry.clockIn)}</b><small>{formatDate(entry.clockIn?.slice(0, 10))}</small></td><td>{entry.clockOut ? <><b>{formatTime(entry.clockOut)}</b><small>{formatDate(entry.clockOut.slice(0, 10))}</small></> : <span className="status-pill status-progress"><i />In progress</span>}</td><td><strong className="hours-value">{entry.hours == null ? '—' : `${entry.hours.toFixed(2)} h`}</strong></td></tr>)}</tbody></table>{!entries.length && <EmptyState icon={Clock3} title="No hours logged yet" detail="Completed shifts will appear here." />}</div>
  </>;
}

function PhotoGallery({ photos, jobs, isAdmin, onUpload }) {
  const [filter, setFilter] = useState('All');
  const filtered = photos.filter((photo) => filter === 'All' || photo.type === filter);
  return <><PageHeading eyebrow="JOB DOCUMENTATION" title={isAdmin ? 'Photo log' : 'Job photos'} detail={isAdmin ? 'Before-and-after records from the field.' : 'A visual record of your completed work.'} action={!isAdmin && jobs.length > 0 ? <button className="button button-dark" onClick={() => onUpload(jobs[0])}><Plus size={16} /> Add photo</button> : null} />
    <div className="gallery-toolbar"><div className="segmented-control">{['All', 'Before', 'After'].map((value) => <button key={value} className={filter === value ? 'segment-active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><span className="photo-count">{filtered.length} {filtered.length === 1 ? 'photo' : 'photos'}</span></div>
    {filtered.length ? <div className="photo-grid">{filtered.map((photo) => <article className="photo-card" key={photo.id}><div className="photo-image"><img src={photo.photo} alt={`${photo.type} at ${photo.address}`} /><span className={`photo-type ${photo.type === 'After' ? 'photo-after' : ''}`}>{photo.type}</span></div><div className="photo-caption"><div><b>{photo.address?.split(',')[0] || photo.jobId}</b><small>{photo.jobId} · {formatDate(photo.timestamp?.slice(0, 10))}</small></div>{isAdmin && <span className="tiny-avatar" title={photo.cleaner_name}>{initials(photo.cleaner_name)}</span>}</div>{photo.notes && <p className="photo-notes">“{photo.notes}”</p>}</article>)}</div> : <div className="surface gallery-empty"><EmptyState icon={Camera} title="No photos here yet" detail={filter === 'All' ? 'Photos shared by your team will appear here.' : `No ${filter.toLowerCase()} photos have been shared.`} /></div>}
  </>;
}

function Team({ users, jobs, onAdd, onMessage }) {
  const cleaners = users.filter((person) => person.role === 'Cleaner');
  return <><PageHeading eyebrow="YOUR PEOPLE" title="The team" detail="The people keeping every place in good shape." action={<button className="button button-dark" onClick={onAdd}><Plus size={16} /> Add teammate</button>} />
    <div className="team-summary-row"><span className="team-count"><b>{cleaners.length.toString().padStart(2, '0')}</b> cleaners</span><span className="team-count"><b>{jobs.filter((job) => job.status === 'In Progress').length.toString().padStart(2, '0')}</b> on site now</span><span className="team-summary-note"><span className="live-dot" />Everything is running smoothly</span></div>
    <div className="team-grid">{cleaners.map((person, index) => { const assigned = jobs.filter((job) => job.cleanerEmail === person.email); const active = assigned.find((job) => job.status === 'In Progress'); return <article className="team-card" key={person.email}><div className={`team-card-top team-tone-${index % 3}`}><span className="team-card-avatar">{initials(person.name)}</span><span className={`status-pill ${active ? 'status-progress' : 'status-pending'}`}><i />{active ? 'On site' : 'Available'}</span><span className="team-decoration">{String(index + 1).padStart(2, '0')}</span></div><div className="team-card-body"><span className="eyebrow">CLEANING TEAM</span><h3>{person.name}</h3><p>{person.email}</p><div className="team-card-details"><span><CalendarDays size={14} />{assigned.length} assigned jobs</span><span><CheckCheck size={14} />{assigned.filter((job) => job.status === 'Completed').length} completed</span></div>{active && <div className="team-current-job"><span className="live-dot" />Currently at <b>{active.address.split(',')[0]}</b></div>}<button className="outline-button team-message" onClick={() => onMessage(person.email)}><MessageCircle size={15} />Send a message</button></div></article>; })}</div>
  </>;
}

function Chat({ user, contacts, jobs, initialPeer, initialJob }) {
  const [peer, setPeer] = useState(initialPeer || '');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [jobId, setJobId] = useState(initialJob || '');
  const [sending, setSending] = useState(false);
  const person = contacts.find((contact) => contact.email === peer);
  const relevantJobs = jobs.filter((job) => user.role === 'Admin' || job.cleanerEmail === user.email);

  useEffect(() => {
    if (contacts.length && !contacts.some((contact) => contact.email === peer)) setPeer(contacts[0].email);
  }, [contacts, peer]);

  useEffect(() => {
    if (initialPeer && contacts.some((contact) => contact.email === initialPeer)) setPeer(initialPeer);
    if (initialJob) setJobId(initialJob);
  }, [initialPeer, initialJob, contacts]);

  useEffect(() => {
    setMessages([]);
    if (!peer) return undefined;
    api(`/api/messages?peer=${encodeURIComponent(peer)}`).then(setMessages).catch(() => {});
    const socket = io({ withCredentials: true });
    socket.on('message:new', (message) => {
      if ((message.senderEmail === peer && message.receiverEmail === user.email) || (message.senderEmail === user.email && message.receiverEmail === peer)) {
        setMessages((previous) => previous.some((item) => item.messageId === message.messageId) ? previous : [...previous, message]);
      }
    });
    return () => socket.disconnect();
  }, [peer, user.email]);

  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || !peer || sending) return;
    setSending(true);
    try {
      const message = await api('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverEmail: peer, content: draft.trim(), jobId: jobId || null }) });
      setMessages((previous) => previous.some((item) => item.messageId === message.messageId) ? previous : [...previous, message]);
      setDraft('');
    } catch (err) {
      window.alert(err.message);
    } finally {
      setSending(false);
    }
  }

  return <><PageHeading eyebrow="DIRECT LINE" title="Messages" detail="A quick note can make someone’s day." />
    <section className="chat-shell surface"><aside className="chat-roster"><div className="roster-heading"><span className="eyebrow">CONVERSATIONS</span><span>{contacts.length}</span></div>{contacts.map((contact) => <button key={contact.email} className={`contact-row ${peer === contact.email ? 'contact-active' : ''}`} onClick={() => setPeer(contact.email)}><span className={`avatar ${contact.role === 'Admin' ? 'avatar-peach' : 'avatar-blue'}`}>{initials(contact.name)}</span><span className="contact-info"><b>{contact.name}</b><small>{contact.lastMessage || contact.role}</small></span><span className="contact-status" /></button>)}{!contacts.length && <p className="quiet-copy roster-empty">No one to message yet.</p>}</aside>
      <div className="chat-main">{person ? <><header className="chat-header"><span className="avatar avatar-mint">{initials(person.name)}</span><span><b>{person.name}</b><small><i className="live-dot" />{person.role === 'Admin' ? 'Workspace manager' : 'Cleaning team'}</small></span><span className="chat-header-end"><MessageCircle size={16} />Direct message</span></header>
        <div className="chat-context"><span><Sparkles size={14} />Keep the whole team in the loop.</span><select aria-label="Attach a job" value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">General message</option>{relevantJobs.map((job) => <option key={job.id} value={job.id}>{job.id} · {job.address.split(',')[0]}</option>)}</select></div>
        <div className="message-list">{messages.length ? <><div className="date-divider"><span>RECENT CONVERSATION</span></div>{messages.map((message) => { const own = message.senderEmail === user.email; return <div key={message.messageId} className={`message-line ${own ? 'message-own' : ''}`}><span className="message-avatar">{initials(own ? user.name : person.name)}</span><div className="message-wrap"><span className="message-author">{own ? 'You' : person.name.split(' ')[0]} <small>{formatTime(message.timestamp)}</small></span><div className="message-bubble">{message.content}</div>{message.jobId && <span className="message-job-tag"><Paperclip size={11} />{message.jobId}</span>}</div></div>; })}</> : <div className="chat-empty"><span className="chat-empty-icon"><MessageCircle size={21} /></span><b>Start the conversation</b><span>Send a note to {person.name.split(' ')[0]}.</span></div>}</div>
        <form className="chat-composer" onSubmit={send}><input aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" maxLength={4000} /><span className="composer-count">{draft.length ? `${draft.length}/4000` : ''}</span><button className="send-button" type="submit" disabled={!draft.trim() || sending} aria-label="Send message"><Send size={16} /></button></form>
      </> : <div className="chat-no-contact"><MessageCircle size={26} /><b>Your conversations live here</b><span>Add a team member to get started.</span></div>}</div>
    </section>
  </>;
}

function JobModal({ users, job, onClose, onSaved }) {
  const cleaners = users.filter((person) => person.role === 'Cleaner');
  const [form, setForm] = useState({ date: job?.date || new Date().toISOString().slice(0, 10), startTime: job?.startTime || '09:00', endTime: job?.endTime || '12:00', address: job?.address || '', instructions: job?.instructions || '', cleanerEmail: job?.cleanerEmail || cleaners[0]?.email || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api(job ? `/api/jobs/${job.id}` : '/api/jobs', { method: job ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); await onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title={job ? `Edit ${job.id}` : 'Schedule a job'} eyebrow={job ? 'UPDATE ASSIGNMENT' : 'NEW ASSIGNMENT'} onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Service address<input value={form.address} onChange={update('address')} placeholder="Street address, city" required /></label><div className="form-two"><label>Date<input type="date" value={form.date} onChange={update('date')} required /></label><label>Assign cleaner<select value={form.cleanerEmail} onChange={update('cleanerEmail')} required>{cleaners.map((person) => <option key={person.email} value={person.email}>{person.name}</option>)}</select></label></div><div className="form-two"><label>Start time<input type="time" value={form.startTime} onChange={update('startTime')} required /></label><label>End time<input type="time" value={form.endTime} onChange={update('endTime')} required /></label></div><label>Instructions<textarea value={form.instructions} onChange={update('instructions')} placeholder="Entry details, priorities, supplies…" rows="3" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="outline-button" type="button" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={busy || !cleaners.length}>{busy ? 'Saving…' : job ? 'Save changes' : 'Add to schedule'}<ArrowRight size={15} /></button></div>{!cleaners.length && <p className="form-error">Add a cleaner to the team before scheduling.</p>}</form></Modal>;
}

function PhotoModal({ job, jobs, onClose, onSaved }) {
  const [jobId, setJobId] = useState(job?.id || jobs[0]?.id || '');
  const [type, setType] = useState('Before');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(); form.append('photo', file); form.append('type', type); form.append('notes', notes);
    try { await api(`/api/jobs/${jobId}/photos`, { method: 'POST', body: form }); await onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title="Add a job photo" eyebrow="FIELD DOCUMENTATION" onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Job<select value={jobId} onChange={(event) => setJobId(event.target.value)}>{jobs.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.address.split(',')[0]}</option>)}</select></label><div className="photo-type-select"><span className="eyebrow">PHOTO TYPE</span><div className="segmented-control">{['Before', 'After'].map((value) => <button type="button" key={value} className={type === value ? 'segment-active' : ''} onClick={() => setType(value)}>{value}</button>)}</div></div><label className="upload-zone"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => setFile(event.target.files[0])} required /><span className="upload-icon"><Camera size={21} /></span><b>{file?.name || 'Choose an image'}</b><small>JPG, PNG, WebP · up to 8 MB</small></label><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What should the team know about this photo?" rows="2" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="outline-button" type="button" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload photo'}<ArrowRight size={15} /></button></div></form></Modal>;
}

function UserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'Cleaner', password: 'welcome123' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); await onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title="Add a teammate" eyebrow="TEAM ACCESS" onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Full name<input value={form.name} onChange={update('name')} placeholder="e.g. Jamie Chen" required /></label><label>Email address<input type="email" value={form.email} onChange={update('email')} placeholder="name@company.com" required /></label><label>Role<select value={form.role} onChange={update('role')}><option value="Cleaner">Cleaner</option><option value="Admin">Admin / Manager</option></select></label><label>Temporary password<input type="text" value={form.password} onChange={update('password')} minLength="8" required /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="outline-button" type="button" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={busy}>{busy ? 'Adding…' : 'Add teammate'}<ArrowRight size={15} /></button></div></form></Modal>;
}

function Modal({ title, eyebrow, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-panel"><header className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header>{children}</section></div>;
}

function EmptyState({ icon: Icon, title, detail }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={20} /></span><b>{title}</b><span>{detail}</span></div>;
}

createRootIfPresent();

function createRootIfPresent() {
  const root = document.getElementById('root');
  if (root) import('react-dom/client').then(({ createRoot }) => createRoot(root).render(<App />));
}
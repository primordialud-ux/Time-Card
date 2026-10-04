import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    .filter((name) => !process.env[name]);
  if (missing.length) {
    console.warn(`Email notification skipped; configure ${missing.join(', ')} in .env.`);
    return null;
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();
  if (!mailer) return { status: 'not_configured' };

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return { status: 'sent' };
}

export function sendJobAssignmentEmail(job, cleaner) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const instructions = job.instructions || 'No special instructions.';
  const text = [
    `Hi ${cleaner.name},`,
    '',
    'A new job has been assigned to you.',
    `Date: ${job.date}`,
    `Start time: ${job.start_time}`,
    `End time: ${job.end_time}`,
    `Address: ${job.address}`,
    `Special instructions: ${instructions}`,
    '',
    `Open TimeCard: ${appUrl}`,
  ].join('\n');
  const html = `<p>Hi ${escapeHtml(cleaner.name)},</p>
    <p>A new job has been assigned to you.</p>
    <ul>
      <li><strong>Date:</strong> ${escapeHtml(job.date)}</li>
      <li><strong>Start time:</strong> ${escapeHtml(job.start_time)}</li>
      <li><strong>End time:</strong> ${escapeHtml(job.end_time)}</li>
      <li><strong>Address:</strong> ${escapeHtml(job.address)}</li>
      <li><strong>Special instructions:</strong> ${escapeHtml(instructions)}</li>
    </ul>
    <p><a href="${escapeHtml(appUrl)}">Open TimeCard</a></p>`;

  return sendEmail({
    to: cleaner.email,
    subject: 'New TimeCard job assignment',
    text,
    html,
  });
}

export function sendNewMessageEmail(recipient, sender, content) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const messagePreview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
  const text = [
    `Hi ${recipient.name},`,
    '',
    `You have a new message from ${sender.name}:`,
    '',
    messagePreview,
    '',
    `Open TimeCard: ${appUrl}`,
  ].join('\n');
  const html = `<p>Hi ${escapeHtml(recipient.name)},</p>
    <p>You have a new message from <strong>${escapeHtml(sender.name)}</strong>:</p>
    <blockquote>${escapeHtml(messagePreview)}</blockquote>
    <p><a href="${escapeHtml(appUrl)}">Open TimeCard</a></p>`;

  return sendEmail({
    to: recipient.email,
    subject: `New TimeCard message from ${sender.name}`,
    text,
    html,
  });
}

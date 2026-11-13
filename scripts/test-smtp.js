import { verifySmtpConnection } from '../server/email.js';

try {
  await verifySmtpConnection();
  console.log('SMTP connection and authentication verified. No email was sent.');
} catch (error) {
  const detail = String(error?.message || error)
    .replaceAll(process.env.SMTP_PASS || '\0', '[redacted]');
  console.error(`SMTP test failed: ${detail}`);
  process.exitCode = 1;
}

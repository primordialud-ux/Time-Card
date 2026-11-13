# TimeCard

Cleaning-service operations app for scheduling jobs, tracking cleaner hours, collecting job photos, and coordinating through live chat.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL printed by the dev server (usually `http://localhost:5173`). The API listens on port `3000`.

The root `.env` configures the API port, SQLite database path, email delivery, and optional Discord notifications. Copy `.env.example` to `.env` locally, or set these values as environment variables in production; deployment does not automatically load the repository's `.env`. To enable email notifications and password-reset links, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`; `SMTP_FROM` is optional. Set `APP_URL` to the public HTTPS address for correct password-reset links. Without SMTP settings, email delivery is skipped and the API logs that it is not configured. To send job-assignment and new-message alerts to Discord, set `DISCORD_WEBHOOK_URL` to a Discord webhook URL.

Run `npm run test:smtp` to verify the configured SMTP connection and authentication without sending an email.

Demo accounts use the password `welcome123`:

| Role | Email |
| --- | --- |
| Admin / Manager | `your@email.com` |
| Cleaner | `cleaner@email.com` |
| Cleaner | `alex@timecard.local` |

For a production-style local run, build the frontend with `npm run build`, then start the API and static app with `npm start`. In production, set `SESSION_SECRET` to a unique random value of at least 32 characters (for example, generate one with `openssl rand -hex 32`). On the first start with an empty database, set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters to create the administrator account. Public signup creates cleaners only. Demo accounts and data are created only outside production; if an older production database contains a demo account still using `welcome123`, startup invalidates that password so it cannot be used.

## Workflows

- Managers can create reusable team profiles, then select a profile when granting team access. Existing team accounts are kept in the profile directory; removing a team account leaves its profile available to add again. Managers can also create and edit job assignments, inspect all time cards and photos, and message cleaners.
- Cleaners see only their assigned work, clock in and out, pause and resume a job for breaks, attach before/after photos with notes, and message the manager. Break durations are tracked separately and excluded from recorded work hours.
- Chat messages are stored in SQLite and delivered over Socket.IO to the sender and recipient. Job-specific messages can be linked to an assignment.
- When SMTP is configured, cleaners receive email when a job is assigned or when they receive a chat message. Reassigning a job notifies its new cleaner. Password-reset links are sent by email.
- When `DISCORD_WEBHOOK_URL` is configured, Discord receives alerts for job assignments, reassignments, and new messages.
- Uploaded images are stored under `server/uploads`; the SQLite database is created at `server/data/timecard.sqlite`.

## Data model

| Table | Purpose |
| --- | --- |
| `users` | Email, name, role, and password hash |
| `team_profiles` | Reusable name and email profiles, independent of team account access |
| `jobs` | Schedule, address, instructions, status, and assigned cleaner |
| `time_entries` | Clock-in/out timestamps and calculated work hours, excluding breaks |
| `time_entry_breaks` | Start/end timestamps for each break taken during a time entry |
| `photos` | Job-linked image URL, before/after type, notes, and timestamp |
| `messages` | Sender, recipient, optional job, content, and timestamp |

The schema is initialized in `server/index.js`; demo users and jobs are inserted on the first run.

## API

All `/api` routes use the login session cookie unless noted.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Create a session from email and password |
| `POST` | `/api/auth/password-reset/request` | Public | Email a reset link when the account exists |
| `POST` | `/api/auth/password-reset/confirm` | Public | Set a new password with a valid reset token |
| `GET` | `/api/auth/me` | Public | Read the current session user |
| `POST` | `/api/auth/logout` | Signed in | End the session |
| `GET`, `POST` | `/api/users` | Signed in, admin to create | List visible users or add a teammate from an existing profile |
| `GET`, `POST` | `/api/profiles` | Admin | List profiles and create a reusable profile |
| `GET`, `POST` | `/api/jobs` | Signed in, admin to create | List scoped jobs or schedule a job |
| `PUT` | `/api/jobs/:id` | Admin | Edit an assignment or cleaner |
| `DELETE` | `/api/jobs/:id` | Admin | Delete a job with no linked time entries, photos, or messages |
| `DELETE` | `/api/users/:email` | Admin | Delete a cleaner with no jobs or associated history/messages |
| `PATCH` | `/api/jobs/:id/status` | Assigned cleaner or admin | Update a job status |
| `GET` | `/api/time` | Signed in | List scoped time entries |
| `POST` | `/api/jobs/:id/clock-in` | Assigned cleaner | Start a time entry |
| `POST` | `/api/jobs/:id/clock-out` | Assigned cleaner | Stop a time entry and calculate hours |
| `POST` | `/api/jobs/:id/pause` | Clocked-in cleaner | Start a tracked break |
| `POST` | `/api/jobs/:id/resume` | Cleaner on break | End the break and resume work |
| `GET` | `/api/photos` | Signed in | List scoped job photos |
| `POST` | `/api/jobs/:id/photos` | Assigned cleaner or admin | Upload an image with type and notes (`multipart/form-data`) |
| `GET` | `/api/contacts` | Signed in | List chat contacts |
| `GET`, `POST` | `/api/messages` | Signed in | Read or send a direct/job-specific message |
| `GET` | `/api/health` | Public | API health check |

Socket.IO authenticates with the same session cookie. New messages are emitted as `message:new` to the sender and recipient.

## Notes

The local starter uses Express's in-memory session store and local disk for photo uploads. For a multi-instance deployment, replace these with a persistent session store and shared object storage, set a strong `SESSION_SECRET`, and replace the demo credentials.
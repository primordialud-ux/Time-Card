# TimeCard

Cleaning-service operations app for scheduling jobs, tracking cleaner hours, collecting job photos, and coordinating through live chat.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL printed by the dev server (usually `http://localhost:5173`). The API listens on port `3001`.

Demo accounts use the password `welcome123`:

| Role | Email |
| --- | --- |
| Admin / Manager | `your@email.com` |
| Cleaner | `cleaner@email.com` |
| Cleaner | `alex@timecard.local` |

For a production-style local run, build the frontend with `npm run build`, then start the API and static app with `npm start`. Set `SESSION_SECRET` to a unique secret outside local development.

## Workflows

- Managers can create and edit job assignments, assign cleaners, inspect all time cards and photos, add team accounts, and message cleaners.
- Cleaners see only their assigned work, clock in and out, attach before/after photos with notes, and message the manager.
- Chat messages are stored in SQLite and delivered over Socket.IO to the sender and recipient. Job-specific messages can be linked to an assignment.
- Uploaded images are stored under `server/uploads`; the SQLite database is created at `server/data/timecard.sqlite`.

## Data model

| Table | Purpose |
| --- | --- |
| `users` | Email, name, role, and password hash |
| `jobs` | Schedule, address, instructions, status, and assigned cleaner |
| `time_entries` | Clock-in/out timestamps and calculated decimal hours |
| `photos` | Job-linked image URL, before/after type, notes, and timestamp |
| `messages` | Sender, recipient, optional job, content, and timestamp |

The schema is initialized in `server/index.js`; demo users and jobs are inserted on the first run.

## API

All `/api` routes use the login session cookie unless noted.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Create a session from email and password |
| `GET` | `/api/auth/me` | Public | Read the current session user |
| `POST` | `/api/auth/logout` | Signed in | End the session |
| `GET`, `POST` | `/api/users` | Signed in, admin to create | List visible users or add a teammate |
| `GET`, `POST` | `/api/jobs` | Signed in, admin to create | List scoped jobs or schedule a job |
| `PUT` | `/api/jobs/:id` | Admin | Edit an assignment or cleaner |
| `PATCH` | `/api/jobs/:id/status` | Assigned cleaner or admin | Update a job status |
| `GET` | `/api/time` | Signed in | List scoped time entries |
| `POST` | `/api/jobs/:id/clock-in` | Assigned cleaner | Start a time entry |
| `POST` | `/api/jobs/:id/clock-out` | Assigned cleaner | Stop a time entry and calculate hours |
| `GET` | `/api/photos` | Signed in | List scoped job photos |
| `POST` | `/api/jobs/:id/photos` | Assigned cleaner or admin | Upload an image with type and notes (`multipart/form-data`) |
| `GET` | `/api/contacts` | Signed in | List chat contacts |
| `GET`, `POST` | `/api/messages` | Signed in | Read or send a direct/job-specific message |
| `GET` | `/api/health` | Public | API health check |

Socket.IO authenticates with the same session cookie. New messages are emitted as `message:new` to the sender and recipient.

## Notes

The local starter uses Express's in-memory session store and local disk for photo uploads. For a multi-instance deployment, replace these with a persistent session store and shared object storage, set a strong `SESSION_SECRET`, and replace the demo credentials.
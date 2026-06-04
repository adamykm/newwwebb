# Nexus Hub

A futuristic, Discord-inspired community workspace with **tasks**, **notes**, **events**, **servers**, **chat**, and an **admin panel**. Built for **Cloudflare Pages + D1** and deployable from **GitHub**.

![Stack](https://img.shields.io/badge/React-19-61dafb) ![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)

## Features

- **Public signup** — anyone can register and manage their own tasks, notes, and events
- **Data isolation** — users only see their personal data; admins see everything
- **Discord-style UI** — server rail, channels, member list, dark glassmorphism theme
- **Servers & chat** — create/join servers with invite codes, `#general` text chat (3s polling)
- **Admin panel** — overview stats + tables for all users, tasks, notes, events, servers
- **Fonts** — Orbitron (display) + Outfit (UI)

## Quick start (local)

### 1. Install dependencies

```bash
npm install
```

### 2. Create local secrets

Copy `.dev.vars.example` to `.dev.vars` and edit:

```bash
cp .dev.vars.example .dev.vars
```

Set a strong `SESSION_SECRET` and your admin credentials:

```
SESSION_SECRET=your-long-random-secret-here
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=YourAdminPassword123
```

Register with that email/password to get an **admin** account automatically.

### 3. Create D1 database & migrate

```bash
npx wrangler d1 create nexus-db
```

Copy the `database_id` from the output into `wrangler.toml` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

```bash
npm run db:migrate:local
```

### 4. Run dev servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API worker: http://localhost:8787 (proxied via Vite)

## Deploy to Cloudflare (GitHub)

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial Nexus Hub"
git push origin main
```

### 2. Connect Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select your repo
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (project root)

### 3. Add D1 binding

In Pages project → **Settings** → **Functions** → **D1 database bindings**:

- Variable name: `DB`
- D1 database: `nexus-db`

Or ensure `wrangler.toml` `database_id` is set and use Wrangler deploy:

```bash
npm run deploy
```

### 4. Set secrets (Cloudflare Dashboard)

**Settings → Environment variables** (Production):

| Variable | Type | Description |
|----------|------|-------------|
| `SESSION_SECRET` | Secret | Long random string for JWT sessions |
| `ADMIN_EMAIL` | Secret | Email that gets admin role on signup |
| `ADMIN_PASSWORD` | Secret | Password matching admin email on signup |

### 5. Run remote migration

```bash
npm run db:migrate:remote
```

### 6. Custom domain

In Pages → **Custom domains** → add your domain (e.g. `hub.yourdomain.com`). Cloudflare DNS will configure automatically if the domain is on Cloudflare.

## Project structure

```
nexus-hub/
├── client/           # Vite + React frontend
├── src/worker/       # Hono API (Cloudflare Worker)
├── src/shared/       # Shared types & utils
├── migrations/       # D1 SQL schema
├── wrangler.toml     # Cloudflare config
└── vite.config.ts
```

## Admin access

1. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Cloudflare secrets (or `.dev.vars` locally)
2. Register at `/register` with that exact email and password
3. You'll see **Admin Panel** in the sidebar

Regular users who sign up with any other email get the `user` role.

## API overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Sign up |
| `POST /api/auth/login` | Sign in |
| `GET /api/tasks` | User's tasks |
| `GET /api/notes` | User's notes |
| `GET /api/events` | User's events |
| `GET /api/servers` | User's servers |
| `POST /api/servers/join` | Join via invite code |
| `GET /api/admin/*` | Admin-only global data |

## License

MIT

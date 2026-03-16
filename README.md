# Ripple

AI Skill sharing platform - discover, preview, download, and spread quality AI Agent skill packages.

## Quick Start

```bash
pnpm docker:up        # Start PostgreSQL + Redis
pnpm env              # Create .env from template (first time)
pnpm install          # Install pnpm workspace dependencies
pnpm setup:backend    # Install backend dependencies
pnpm setup:frontend   # Install frontend dependencies
pnpm setup            # Install backend dependencies and sync frontend
pnpm db:upgrade       # Apply database migrations
pnpm dev              # Start backend (:8000) + frontend (:3000)
```

Middleware services are managed by Docker Compose. Edit `backend/.env` to set `DATABASE_URL` if you need a custom database host.
Install [uv](https://docs.astral.sh/uv/) if you haven't: `curl -LsSf https://astral.sh/uv/install.sh | sh`
Frontend package management uses `pnpm` via Corepack.

Run `pnpm run` to see all available commands.

## Database Workflow

- Middleware lifecycle: `docker compose`
- Schema initialization and upgrades: `Alembic`
- Seed data import: `backend/seed_skills.py`

See [docs/database-workflow.md](/var/www/python/ripple/docs/database-workflow.md) for the full workflow.

## Project Structure

```
ripple/
├── frontend/          # Next.js frontend (TypeScript, Tailwind CSS)
├── backend/           # FastAPI backend (Python, SQLAlchemy)
├── skills/            # Skill file storage (Git-managed)
└── docs/              # Documentation
```

## Features

- Skill browsing, search, and filtering (no login required)
- Skill detail with beautified Markdown rendering
- Skill upload with automatic validation and rating (S/A/B/C)
- RP (Ripple Push) - spread quality skills through random push mechanism
- SSE real-time notifications
- AI-generated user profiles (nicknames/descriptions)
- Admin dashboard with statistics
- One-line install command for skills

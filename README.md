# Ripple

AI Skill sharing platform - discover, preview, download, and spread quality AI Agent skill packages.

## Quick Start

```bash
make env              # Create .env from template (first time)
make install          # Install all dependencies
make dev              # Start backend (:8000) + frontend (:3000)
```

Requires PostgreSQL. Edit `backend/.env` to set `DATABASE_URL`.
Install [uv](https://docs.astral.sh/uv/) if you haven't: `curl -LsSf https://astral.sh/uv/install.sh | sh`

Run `make help` to see all available commands.

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
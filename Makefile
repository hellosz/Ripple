.PHONY: help install dev dev-backend dev-frontend db-init db-migrate db-upgrade \
       build lint test clean docker-build docker-up docker-down

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
BACKEND_DIR  := backend
FRONTEND_DIR := frontend

# ──────────────────────────────────────────────
# Help (default target)
# ──────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────
install: ## Install all dependencies (backend + frontend)
	cd $(BACKEND_DIR) && uv sync
	cd $(FRONTEND_DIR) && npm install

env: ## Create .env from example (won't overwrite existing)
	@test -f $(BACKEND_DIR)/.env \
		&& echo "$(BACKEND_DIR)/.env already exists, skipping" \
		|| (cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env \
		    && echo "Created $(BACKEND_DIR)/.env — edit it with your settings")

# ──────────────────────────────────────────────
# Development
# ──────────────────────────────────────────────
dev: ## Start backend & frontend concurrently
	@echo "Starting backend on :8000 and frontend on :3000 ..."
	@trap 'kill 0' INT TERM; \
		$(MAKE) dev-backend & \
		$(MAKE) dev-frontend & \
		wait

dev-backend: ## Start backend dev server (hot-reload)
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start frontend dev server
	cd $(FRONTEND_DIR) && npm run dev

# ──────────────────────────────────────────────
# Database
# ──────────────────────────────────────────────
db-init: ## Create DB tables from models (first-time setup)
	cd $(BACKEND_DIR) && uv run python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"

db-migrate: ## Generate a new Alembic migration (MSG=required)
	@test -n "$(MSG)" || (echo "Usage: make db-migrate MSG='add users table'" && exit 1)
	cd $(BACKEND_DIR) && uv run alembic revision --autogenerate -m "$(MSG)"

db-upgrade: ## Apply all pending migrations
	cd $(BACKEND_DIR) && uv run alembic upgrade head

db-downgrade: ## Rollback one migration
	cd $(BACKEND_DIR) && uv run alembic downgrade -1

db-seed: ## Seed skills from /skills/ directory into database
	cd $(BACKEND_DIR) && uv run python seed_skills.py

# ──────────────────────────────────────────────
# Quality
# ──────────────────────────────────────────────
lint: ## Lint frontend code
	cd $(FRONTEND_DIR) && npm run lint

test: ## Run backend tests
	cd $(BACKEND_DIR) && uv run pytest -v

# ──────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────
build: ## Build frontend for production
	cd $(FRONTEND_DIR) && npm run build

build-backend: ## Build backend Docker image
	docker build -t ripple-backend $(BACKEND_DIR)

# ──────────────────────────────────────────────
# Docker Compose
# ──────────────────────────────────────────────
docker-up: ## Start all services via Docker Compose
	docker compose up -d

docker-down: ## Stop all Docker Compose services
	docker compose down

docker-logs: ## Tail Docker Compose logs
	docker compose logs -f

# ──────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────
cli-pack: ## Package CLI tool into .tgz and copy to backend/static/cli/
	cd cli && npm pack
	mkdir -p $(BACKEND_DIR)/static/cli
	mv cli/anthropic-ai-ripple-cli-*.tgz $(BACKEND_DIR)/static/cli/ripple-cli.tgz
	@echo "  CLI packaged → $(BACKEND_DIR)/static/cli/ripple-cli.tgz"
	@echo "  Users can install with: npm i -g https://<your-server>/static/cli/ripple-cli.tgz"

clean: ## Remove build artifacts and caches
	rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true

lock: ## Regenerate backend uv.lock
	cd $(BACKEND_DIR) && uv lock

add: ## Add a backend dependency (PKG=required), e.g. make add PKG=redis
	@test -n "$(PKG)" || (echo "Usage: make add PKG=redis" && exit 1)
	cd $(BACKEND_DIR) && uv add $(PKG)

add-dev: ## Add a backend dev dependency, e.g. make add-dev PKG=ruff
	@test -n "$(PKG)" || (echo "Usage: make add-dev PKG=ruff" && exit 1)
	cd $(BACKEND_DIR) && uv add --group dev $(PKG)

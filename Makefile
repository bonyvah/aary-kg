# One command for the whole development stack:   make up
# Postgres, Redis, the backend and the web app, all in Docker (docker compose). `make help` lists everything.
#
# Needs: docker (with compose), curl. `make test`, `make check` and `make admin` also need uv, pnpm and
# node 22 on this machine. The backend and the web app reload when you save a file.

BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 3000
export BACKEND_PORT FRONTEND_PORT

COMPOSE := docker compose

.DEFAULT_GOAL := help
.PHONY: help up down restart status logs db db-stop install env migrate admin test check e2e clean reset-db

help: ## show this list
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

# --- the whole stack -----------------------------------------------------------------------------

up: ## stop other containers, then start everything in Docker: Postgres, Redis, backend, web app (first run builds and installs, a few minutes)
	@docker ps -q --filter label=com.docker.compose.project | xargs -r docker stop
	@$(COMPOSE) up -d --wait
	@$(COMPOSE) exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='aary_test'" | grep -q 1 \
		|| $(COMPOSE) exec -T postgres createdb -U postgres aary_test
	@echo ""
	@echo "  web app   http://localhost:$(FRONTEND_PORT)"
	@echo "  API docs  http://localhost:$(BACKEND_PORT)/docs"

build: ## stop other containers, then start everything in Docker: Postgres, Redis, backend, web app (first run builds and installs, a few minutes)
	@docker ps -q --filter label=com.docker.compose.project | xargs -r docker stop
	@$(COMPOSE) up -d --build --wait
	@$(COMPOSE) exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='aary_test'" | grep -q 1 \
		|| $(COMPOSE) exec -T postgres createdb -U postgres aary_test
	@echo ""
	@echo "  web app   http://localhost:$(FRONTEND_PORT)"
	@echo "  API docs  http://localhost:$(BACKEND_PORT)/docs"
	@echo ""
	@echo "  first time? create an admin:  make admin LOGIN=aizhan NAME=\"Your Name\""
	@echo "  logs: make logs      stop: make down"

down: ## stop everything (data is kept)
	@$(COMPOSE) stop

restart: ## restart the backend and the web app (the databases keep running)
	@$(COMPOSE) restart backend frontend

status: ## what is running
	@$(COMPOSE) ps
	@curl -sf localhost:$(BACKEND_PORT)/health/ready || echo "  backend /health/ready: not answering"

logs: ## follow the backend and web app logs (Ctrl-C to leave them running)
	@$(COMPOSE) logs -f --tail=20 backend frontend

# --- the parts -------------------------------------------------------------------------------------

db: ## start only Postgres + Redis (for tests) and wait until they answer
	@$(COMPOSE) up -d --wait postgres redis
	@# the tests use their own database: create it once
	@$(COMPOSE) exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='aary_test'" | grep -q 1 \
		|| $(COMPOSE) exec -T postgres createdb -U postgres aary_test

db-stop: ## stop Postgres + Redis (data is kept)
	@$(COMPOSE) stop postgres redis

install: ## install dependencies (only when they changed)
	@cd backend && uv sync --quiet
	@cd frontend && if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then pnpm install --frozen-lockfile; fi

env: ## create backend/.env from the example, once (for tools run on this machine, not for Docker)
	@[ -f backend/.env ] || { cp backend/.env.example backend/.env && echo "created backend/.env (development settings)"; }

migrate: ## apply database migrations (they also run whenever the backend container starts)
	@$(COMPOSE) exec backend alembic upgrade head

admin: ## create an admin: make admin LOGIN=aizhan FIRST=Aizhan LAST=Bekova (prints a password once)
	@test -n "$(LOGIN)" -a -n "$(FIRST)" -a -n "$(LAST)" || { echo 'usage: make admin LOGIN=aizhan FIRST=Aizhan LAST=Bekova'; exit 2; }
	@$(COMPOSE) exec backend python -m app.cli create-admin --login "$(LOGIN)" --first-name "$(FIRST)" --last-name "$(LAST)"

# --- checks ----------------------------------------------------------------------------------------

test: db install ## backend tests (own database and Redis db 15, never your dev data)
	cd backend && uv run pytest -q

check: db install ## every static check: lint, types, tests, frontend checks, build, player bundle
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
	cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm check && pnpm build && pnpm check:bundle

e2e: ## browser tests against the running stack: make e2e LOGIN=<admin> PASSWORD=<password>
	@test -n "$(LOGIN)" -a -n "$(PASSWORD)" || { echo 'usage: make e2e LOGIN=<admin login> PASSWORD=<password>'; exit 2; }
	cd frontend && E2E_BASE_URL=http://localhost:$(FRONTEND_PORT) E2E_LOGIN="$(LOGIN)" E2E_PASSWORD="$(PASSWORD)" pnpm e2e

# --- cleaning --------------------------------------------------------------------------------------

clean: ## remove the containers and the web app's build cache (data is kept)
	@$(COMPOSE) down

reset-db: ## DELETE all development data (Postgres volume): make reset-db CONFIRM=yes
	@test "$(CONFIRM)" = yes || { echo "this deletes every user, quiz, contest and game in the dev database. Run: make reset-db CONFIRM=yes"; exit 2; }
	@$(COMPOSE) down -v

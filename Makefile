# One command for the whole development stack:   make up
# Postgres + Redis (Docker), then the backend and the web app. `make help` lists everything.
#
# Needs: docker (with compose), uv, pnpm, node 22, curl. Without Docker, start your own Postgres and
# Redis and run `make up SKIP_DOCKER=1` (the URLs are in backend/.env).

BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 3000
SKIP_DOCKER   ?=

COMPOSE := docker compose
RUN     := .run
# Each server runs in its own process group (setsid) so `make down` stops it and what it spawned.
START   = setsid nohup

.DEFAULT_GOAL := help
.PHONY: help up down restart status logs db db-stop backend frontend install env migrate admin \
        test check e2e clean reset-db

help: ## show this list
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

# --- the whole stack -----------------------------------------------------------------------------

up: db install env migrate ## start everything: Postgres, Redis, backend, web app (in the background)
	@mkdir -p $(RUN)
	@$(MAKE) --no-print-directory stop-servers
	@echo "starting the backend on :$(BACKEND_PORT) and the web app on :$(FRONTEND_PORT) ..."
	@cd backend && $(START) uv run uvicorn app.main:app --reload --port $(BACKEND_PORT) --no-proxy-headers \
		> ../$(RUN)/backend.log 2>&1 & echo $$! > $(RUN)/backend.pid
	@cd frontend && API_URL=http://localhost:$(BACKEND_PORT) $(START) pnpm exec next dev -p $(FRONTEND_PORT) \
		> ../$(RUN)/frontend.log 2>&1 & echo $$! > $(RUN)/frontend.pid
	@$(MAKE) --no-print-directory wait
	@echo ""
	@echo "  web app   http://localhost:$(FRONTEND_PORT)"
	@echo "  API docs  http://localhost:$(BACKEND_PORT)/docs"
	@echo ""
	@echo "  first time? create an admin:  make admin LOGIN=aizhan FIRST=Aizhan LAST=Bekova"
	@echo "  logs: make logs      stop: make down"

down: stop-servers ## stop the backend and the web app, and Postgres + Redis (data is kept)
	@$(MAKE) --no-print-directory db-stop

restart: ## restart the backend and the web app (the databases keep running)
	@$(MAKE) --no-print-directory up SKIP_DOCKER=1

status: ## what is running
	@for s in backend frontend; do \
		if [ -f $(RUN)/$$s.pid ] && kill -0 $$(cat $(RUN)/$$s.pid) 2>/dev/null; then echo "  $$s: running (pid $$(cat $(RUN)/$$s.pid))"; else echo "  $$s: stopped"; fi; \
	done
	@curl -sf localhost:$(BACKEND_PORT)/health/ready || echo "  backend /health/ready: not answering"
	@echo ""
	@if [ -z "$(SKIP_DOCKER)" ]; then $(COMPOSE) ps; fi

logs: ## follow the backend and web app logs (Ctrl-C to leave them running)
	@tail -n 20 -F $(RUN)/backend.log $(RUN)/frontend.log

# --- the parts -------------------------------------------------------------------------------------

db: ## start Postgres + Redis (Docker) and wait until they answer
ifeq ($(SKIP_DOCKER),)
	@$(COMPOSE) up -d --wait
	@# the tests use their own database: create it once
	@$(COMPOSE) exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='aary_test'" | grep -q 1 \
		|| $(COMPOSE) exec -T postgres createdb -U postgres aary_test
else
	@echo "SKIP_DOCKER set: using the Postgres and Redis already running (see backend/.env)"
endif

db-stop: ## stop Postgres + Redis (data is kept)
ifeq ($(SKIP_DOCKER),)
	@$(COMPOSE) stop
endif

backend: db install env migrate ## run the backend in this terminal (auto-reload)
	cd backend && uv run uvicorn app.main:app --reload --port $(BACKEND_PORT) --no-proxy-headers

frontend: install ## run the web app in this terminal (hot reload)
	cd frontend && API_URL=http://localhost:$(BACKEND_PORT) pnpm exec next dev -p $(FRONTEND_PORT)

install: ## install dependencies (only when they changed)
	@cd backend && uv sync --quiet
	@cd frontend && if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then pnpm install --frozen-lockfile; fi

env: ## create backend/.env from the example, once
	@[ -f backend/.env ] || { cp backend/.env.example backend/.env && echo "created backend/.env (development settings)"; }

migrate: ## apply database migrations
	@cd backend && uv run alembic upgrade head

admin: ## create an admin: make admin LOGIN=aizhan FIRST=Aizhan LAST=Bekova (prints a password once)
	@test -n "$(LOGIN)" -a -n "$(FIRST)" -a -n "$(LAST)" || { echo 'usage: make admin LOGIN=aizhan FIRST=Aizhan LAST=Bekova'; exit 2; }
	@cd backend && uv run python -m app.cli create-admin --login "$(LOGIN)" --first-name "$(FIRST)" --last-name "$(LAST)"

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

clean: stop-servers ## stop the servers and delete logs and build output
	@rm -rf $(RUN) frontend/.next

reset-db: ## DELETE all development data (Postgres volume): make reset-db CONFIRM=yes
	@test "$(CONFIRM)" = yes || { echo "this deletes every user, quiz, contest and game in the dev database. Run: make reset-db CONFIRM=yes"; exit 2; }
	@$(MAKE) --no-print-directory stop-servers
	@$(COMPOSE) down -v

# --- internals -------------------------------------------------------------------------------------

.PHONY: stop-servers wait
stop-servers:
	@for s in backend frontend; do \
		if [ -f $(RUN)/$$s.pid ]; then \
			pid=$$(cat $(RUN)/$$s.pid); \
			kill -- -$$pid 2>/dev/null && echo "stopped $$s"; \
			rm -f $(RUN)/$$s.pid; \
		fi; \
	done; true

wait:
	@for i in $$(seq 1 90); do \
		curl -sf localhost:$(BACKEND_PORT)/health/ready >/dev/null && b=1 || b=0; \
		curl -sf localhost:$(FRONTEND_PORT)/ >/dev/null && f=1 || f=0; \
		[ $$b = 1 ] && [ $$f = 1 ] && exit 0; \
		sleep 1; \
	done; \
	echo "did not come up in 90 s. Last lines of the logs:"; tail -n 15 $(RUN)/backend.log $(RUN)/frontend.log; exit 1

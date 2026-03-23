.PHONY: up down lint test test-api test-ui migrate seed-db reset reset-with-data \
       deploy setup-vps prod-build prod-up prod-down prod-logs prod-shell prod-createsuperuser

VPS_HOST ?= vps
VPS_DIR ?= ~/gibolin

up:
	docker compose up

down:
	docker compose down

lint:
	docker compose run --rm api ruff check
	docker compose run --rm ui npm run lint

test: test-api test-ui

test-api:
	docker compose run --rm api python manage.py test cave.tests

test-ui:
	docker compose run --rm ui npm run test:run

migrate:
	docker compose run --rm api python manage.py migrate

seed-db: migrate
	docker compose run --rm api python manage.py load_test_data --clear

reset:
	docker compose down -v --remove-orphans

reset-with-data: reset
	docker compose up -d postgres
	sleep 5
	$(MAKE) seed-db

setup-vps:
	ssh $(VPS_HOST) 'git init --bare ~/gibolin.git && mkdir -p ~/gibolin'
	scp hooks/post-receive $(VPS_HOST):~/gibolin.git/hooks/post-receive
	ssh $(VPS_HOST) 'chmod +x ~/gibolin.git/hooks/post-receive'
	git remote add vps $(VPS_HOST):~/gibolin.git || git remote set-url vps $(VPS_HOST):~/gibolin.git
	@echo "VPS ready. Place .env.prod at ~/gibolin/.env.prod, then: make deploy"

deploy:
	git push vps main
	@echo "Waiting for healthcheck..."
	@for i in $$(seq 1 30); do \
		if ssh $(VPS_HOST) 'curl -sf http://localhost:8000/api/healthcheck' > /dev/null 2>&1; then \
			echo "Healthcheck passed."; \
			exit 0; \
		fi; \
		sleep 2; \
	done; \
	echo "ERROR: Healthcheck failed after 60s."; \
	exit 1

prod-build:
	docker compose -f docker-compose.prod.yml build

prod-up:
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-shell:
	docker compose -f docker-compose.prod.yml exec api python manage.py shell

prod-createsuperuser:
	docker compose -f docker-compose.prod.yml exec api python manage.py createsuperuser

.PHONY: up down lint test test-api test-ui seed-db reset reset-with-data

up:
	docker-compose up

down:
	docker-compose down

lint:
	docker-compose run --rm api ruff check

test: test-api test-ui

test-api:
	docker-compose run --rm api python manage.py test cave.tests

test-ui:
	docker-compose run --rm ui npm run test:run

seed-db:
	docker-compose run --rm api python manage.py load_test_data --clear

reset:
	docker-compose down -v --remove-orphans

reset-with-data: reset
	docker-compose up -d postgres
	sleep 5
	docker-compose run --rm api python manage.py migrate
	docker-compose run --rm api python manage.py load_test_data --clear

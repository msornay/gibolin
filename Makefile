.PHONY: test test-api test-ui

test: test-api test-ui

test-api:
	docker-compose run api python manage.py test cave.tests

test-ui:
	docker-compose run ui npm run test:run

reset:
	docker-compose down -v --remove-orphans

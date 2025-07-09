.PHONY: test test-api test-ui

test: test-api test-ui

test-api:
	docker-compose exec api python manage.py test cave.tests --settings=gibolin.settings_test

test-ui:
	docker-compose exec ui npm run test:run
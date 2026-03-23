#!/bin/sh
set -e
python manage.py migrate --noinput
exec gunicorn gibolin.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --access-logfile -

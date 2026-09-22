#!/bin/sh
set -e

if [ "$SQLITE_PATH" != ":memory:" ]; then
    mkdir -p "$(dirname "$SQLITE_PATH")"
fi

python manage.py migrate --noinput
python manage.py seed_demo_data

exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --access-logfile - \
    --error-logfile -

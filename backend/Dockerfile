# syntax=docker/dockerfile:1

FROM python:3.12.2-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

ARG APP_UID=10001
ARG APP_GID=10001

RUN groupadd --gid "${APP_GID}" app \
    && useradd --uid "${APP_UID}" --gid app --no-log-init --create-home app \
    && install -d --owner=app --group=app /var/lib/spend-tracker

COPY requirements.lock ./requirements.lock

RUN python -m pip install --no-cache-dir -r requirements.lock

COPY --chown=app:app src ./src

USER app
WORKDIR /app/src

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind=0.0.0.0:8000", "--access-logfile=-", "--error-logfile=-"]

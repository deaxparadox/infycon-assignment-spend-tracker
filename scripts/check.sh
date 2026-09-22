#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${NEXT_PUBLIC_API_URL:-}" ]]; then
    echo "NEXT_PUBLIC_API_URL is required to build the frontend." >&2
    exit 1
fi

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "${script_directory}/.." && pwd)"
unix_python="${repository_root}/backend/.venv/bin/python"
windows_python="${repository_root}/backend/.venv/Scripts/python.exe"

if [[ -x "${unix_python}" ]]; then
    python="${unix_python}"
elif [[ -x "${windows_python}" ]]; then
    python="${windows_python}"
else
    echo "Backend virtual environment is missing. Create backend/.venv first." >&2
    exit 1
fi

(
    cd -- "${repository_root}/backend"
    "${python}" -m ruff check .
    "${python}" -m ruff format --check .
    "${python}" -m pytest
    "${python}" src/manage.py check --settings=config.settings.test
    "${python}" src/manage.py makemigrations --check --dry-run --settings=config.settings.test
)

(
    cd -- "${repository_root}/frontend"
    npm run check
)

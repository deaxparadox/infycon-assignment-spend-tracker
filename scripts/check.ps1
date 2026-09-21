$ErrorActionPreference = "Stop"

if (-not $env:NEXT_PUBLIC_API_URL) {
    throw "NEXT_PUBLIC_API_URL is required to build the frontend."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repositoryRoot "backend\.venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend virtual environment is missing. Create backend/.venv first."
}

Push-Location (Join-Path $repositoryRoot "backend")
try {
    & $python -m ruff check .
    if ($LASTEXITCODE -ne 0) { throw "Backend lint failed." }

    & $python -m ruff format --check .
    if ($LASTEXITCODE -ne 0) { throw "Backend formatting check failed." }

    & $python -m pytest
    if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }

    & $python src/manage.py check --settings=config.settings.test
    if ($LASTEXITCODE -ne 0) { throw "Django system check failed." }

    & $python src/manage.py makemigrations --check --dry-run --settings=config.settings.test
    if ($LASTEXITCODE -ne 0) { throw "Django migration check failed." }
}
finally {
    Pop-Location
}

Push-Location (Join-Path $repositoryRoot "frontend")
try {
    & npm run check
    if ($LASTEXITCODE -ne 0) { throw "Frontend checks failed." }
}
finally {
    Pop-Location
}

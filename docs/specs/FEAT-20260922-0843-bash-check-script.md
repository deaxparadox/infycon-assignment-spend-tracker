# FEAT-20260922-0843 — Bash verification script

- **Status:** Approved
- **Working branch:** `main`
- **Base branch:** `main`

## Need

Provide a Bash equivalent of `scripts/check.ps1` so Linux, macOS, WSL, and Git Bash users can invoke the same repository verification sequence without maintaining different command sets.

## Verified current state

`scripts/check.ps1` is the only file under `scripts/`. It:

1. requires `NEXT_PUBLIC_API_URL`;
2. requires the project backend virtual environment;
3. runs Ruff lint and formatting checks;
4. runs the complete backend test suite;
5. runs Django system and migration-drift checks; and
6. runs the frontend aggregate check command.

No database, startup, deployment, or other helper script currently exists.

## Implementation

Create executable `scripts/check.sh` using Bash strict mode.

- Resolve the repository root relative to the script instead of the caller's current directory.
- Fail clearly if `NEXT_PUBLIC_API_URL` is missing.
- Select `backend/.venv/bin/python` for Unix virtual environments.
- Select `backend/.venv/Scripts/python.exe` explicitly when running under Git Bash with a Windows-created virtual environment.
- Fail clearly if neither supported interpreter path exists; do not silently use a global Python installation.
- Run the same backend commands in the same order as the PowerShell script.
- Run `npm run check` from the frontend directory.
- Let the first failing command terminate the script with a nonzero status.

Update the README verification section to show both PowerShell and Bash entry points and explain the supported virtual-environment layouts.

## Verification boundary

Per the user's direct instruction, do not execute `scripts/check.sh` or rerun its underlying tests. Review it line by line against `scripts/check.ps1`, check its executable Git mode, and perform diff hygiene only. State clearly that the new script remains unexecuted.

## Recursive checks

### Lateral spread

Search the repository for other scripts or documented verification command sequences. Ensure the README does not leave a third divergent command path and that both wrappers delegate to the existing project-level commands.

### Causal depth

Confirm parity includes prerequisites, working directories, command order, exit behavior, Unix virtual environments, and Git Bash Windows virtual environments—not only a transliteration of PowerShell syntax.

## Commit boundary

One coherent commit will contain `scripts/check.sh`, README verification documentation, spec completion, and in-place TODO completion.

# FEAT-20260922-0843 — Bash verification script

- **Status:** Implemented
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

## Implementation results

- Added a strict-mode Bash wrapper that resolves the repository relative to its own path, requires the frontend build URL, and never selects global Python implicitly.
- Added explicit interpreter branches for Unix virtual environments and Windows virtual environments invoked through Git Bash.
- Mirrored the PowerShell backend and frontend commands in the same order and isolated each working-directory change in a subshell.
- Documented both wrapper invocations and their supported virtual-environment layouts.
- Marked the script executable in Git.
- Per direct instruction, the Bash wrapper, PowerShell wrapper, and all commands they contain were not executed.

## Recursive check results

### Lateral spread

Repository script discovery found only `scripts/check.ps1` and the new `scripts/check.sh`. The README's manual backend/frontend lists use the same underlying commands, and its aggregate verification section now points to the two wrappers without introducing another helper or divergent sequence.

### Causal depth

Line-by-line source review confirmed parity for the required environment value, missing-virtual-environment failure, repository-relative paths, Ruff lint/format, pytest, Django system and migration-drift checks, frontend aggregate checks, command order, first-failure exit behavior, and both supported virtual-environment layouts. The script was intentionally not syntax-checked or run, so runtime shell compatibility remains unverified.

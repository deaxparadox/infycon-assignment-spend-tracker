# ISS-20260921-2243 — Repository line endings

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`

## Problem

The foundation files generated on Windows include a mix of LF and CRLF line endings. Because this repository has `core.autocrlf=false` and no repository line-ending policy, twelve text files were committed with CRLF endings. `git diff --check` therefore reported the carriage return on every added line as trailing whitespace, making the whitespace check noisy and unreliable.

## Verified causes

- The user-level Git setting is `core.autocrlf=false`, so Git performs no automatic line-ending normalization.
- The repository has no `.gitattributes` policy.
- `git ls-files --eol` reports twelve committed files with CRLF in both the index and worktree, while the rest of the text files use LF.
- The affected files are generated Python/project files plus `.python-version`; this is a repository-wide consistency problem, not an application-logic defect.

## Proposed fix

1. Add `.gitattributes` with `* text=auto eol=lf` and explicit binary exclusions where useful.
2. Renormalize the tracked files through Git so text files use LF without changing their content.
3. Verify `git ls-files --eol` has no tracked CRLF text files and `git diff --check` passes.
4. Close this issue in the same focused commit, then resume the approved authentication item.

## Recursive checks

### Lateral spread

Inspect every tracked file through `git ls-files --eol`, not just the first generated Python file that exposed the problem. Confirm binary assets are not transformed.

### Causal depth

Confirm the failures come from the combination of CRLF blobs, disabled automatic conversion, and the missing repository policy. Rule out actual spaces or tabs at line ends after normalization.

## Acceptance criteria

- A repository-owned line-ending policy works independently of each contributor's Git setting.
- All tracked text files are stored as LF.
- Binary files remain binary.
- `git diff --check` passes without suppressing whitespace errors.

## Commit boundary

One corrective commit will contain `.gitattributes`, mechanical line-ending normalization, the completed spec status, and this TODO item's in-place completion.

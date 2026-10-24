# cooldownlint

**Check that every package manager in your repo waits before installing brand-new releases.** cooldownlint finds npm, pnpm, Bun, uv, pip, Renovate and Dependabot in a project and tells you the *effective* dependency cooldown for each one (`min-release-age`, `minimumReleaseAge`, `exclude-newer`, `uploaded-prior-to`, `cooldown.default-days`), or that there is none.

[![CI](https://github.com/ArisRhiannon/cooldownlint/actions/workflows/ci.yml/badge.svg)](https://github.com/ArisRhiannon/cooldownlint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Offline](https://img.shields.io/badge/network-none-informational)

```bash
npx github:ArisRhiannon/cooldownlint --fix
```

Example output (illustrative):

```
npm         none         
uv          7 days       pyproject.toml [tool.uv] exclude-newer
dependabot  7 days       .github/dependabot.yml cooldown.default-days

HIGH    CD001 npm: no cooldown configured (detected via package-lock.json)
        # .npmrc (npm >= 11.10)
        min-release-age=7
LOW     CD005 dependabot: 1 of 2 update entries have no cooldown

policy: >= 3 days | 2 finding(s)
```

## Why

Most malicious releases in the 2025-2026 npm and PyPI worm waves were found and pulled within hours ([pnpm's rationale](https://pnpm.io/supply-chain-security)). A cooldown, meaning "never install a version younger than N days", blocks that whole class cheaply. Every major tool now supports one, but each uses a **different key and a different unit**:

| Tool | Setting | Unit |
|---|---|---|
| npm (>= 11.10) | `min-release-age` in `.npmrc` | days |
| pnpm (>= 10.16) | `minimumReleaseAge` in `pnpm-workspace.yaml` | minutes |
| Bun | `[install] minimumReleaseAge` in `bunfig.toml` | seconds |
| uv (>= 0.9.17) | `exclude-newer` in `pyproject.toml` / `uv.toml` | duration (`"7 days"`, `P7D`) |
| pip (>= 26.1) | `uploaded-prior-to` | ISO duration (`P7D`) |
| Renovate | `minimumReleaseAge` | duration string |
| Dependabot | `cooldown.default-days` per update entry | days |

Setting "7" in the wrong place silently means 7 minutes or 7 seconds. cooldownlint normalises everything to days and checks it against one policy. Source for the table: [cooldowns.dev](https://cooldowns.dev/).

## Install and use

```bash
npx github:ArisRhiannon/cooldownlint            # current directory
npx github:ArisRhiannon/cooldownlint ./service --min-days 7
cooldownlint --format json                        # machine-readable
cooldownlint --format sarif > cooldown.sarif      # GitHub code scanning
cooldownlint --fix                                # print the snippet to add
```

The package is not on npm yet. Run it from GitHub as shown, or clone it and run `node bin/cooldownlint.js`. Requires Node 18+, no dependencies.

Exit codes: `0` ok, `1` findings at or above `--fail-on` (default `medium`), `2` usage error.

### GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: ArisRhiannon/cooldownlint@v0.1.0
  with:
    min-days: 7
```

## Rules

| ID | Severity | Fires when |
|---|---|---|
| CD001 | high | A package manager is in use with no cooldown |
| CD002 | medium | The cooldown is shorter than `--min-days` |
| CD003 | medium | A fixed timestamp (`before=`, `exclude-newer = "2026-..."`) is used instead of a rolling duration |
| CD004 | medium | Renovate or Dependabot is configured with no waiting period |
| CD005 | low | Only some Dependabot update entries have a cooldown |
| CD006 | info | pnpm with no explicit setting (pnpm 11+ defaults to 1 day; older versions don't) |

## How detection works

- **npm**: `package-lock.json`, or a `package.json` with no other lockfile. Reads `NPM_CONFIG_MIN_RELEASE_AGE`, then the project `.npmrc`.
- **pnpm**: `pnpm-lock.yaml` / `pnpm-workspace.yaml`, plus the pnpm 10 `.npmrc` form.
- **Bun**: `bun.lock`, `bun.lockb` or `bunfig.toml`.
- **uv**: `uv.lock`. Reads `UV_EXCLUDE_NEWER`, `uv.toml`, then `[tool.uv]`.
- **pip**: `requirements*.txt` (when there is no `uv.lock`). Reads `PIP_UPLOADED_PRIOR_TO`, `pip.conf`/`pip.ini`, and `--uploaded-prior-to` inside the requirements file.
- **Renovate**: common config file locations; `minimumReleaseAge`, legacy `stabilityDays`, and `config:best-practices` (which sets 3 days for npm).
- **Dependabot**: `.github/dependabot.yml`.

## Limits

- Only the **project** config is read. User-level `~/.npmrc`, global `uv.toml` and CI-only environment variables are invisible unless they are set when cooldownlint runs. That is intentional, since CI is what matters, but keep it in mind locally.
- The YAML/TOML/JSON5 readers are deliberately small and line-based. Unusual formatting (multi-line inline tables, anchors) may be missed. Please open an issue with a sample.
- Yarn (`npmMinimalAgeGate`), Cargo, Go and Maven are not covered yet.
- Per-package exclusions (`min-release-age-exclude`, `minimumReleaseAgeExclude`, `exclude-newer-package`) are not evaluated yet.

## FAQ

**Will a cooldown stop me getting urgent security fixes?** Every tool has a per-package exclusion for that (see the limits above). Use it for the fix, then remove it.

**Does this replace lockfile review?** No. Pair it with [lockgate](https://github.com/ArisRhiannon/lockgate) (npm lockfile diff gate) and a vulnerability scanner.

## Related

- [lockgate](https://github.com/ArisRhiannon/lockgate): offline npm lockfile diff gate for pull requests
- [wormguard](https://github.com/ArisRhiannon/wormguard): behavioural audit of npm install scripts

## License

[MIT](LICENSE)

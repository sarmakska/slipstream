#!/bin/bash
# Ship v0.6.0 from a clean working tree at /Users/sarma_linux/Desktop/opensource/slipstream/repo.
# Run from inside the repo:
#   bash scripts/ship-v0.6.0.sh
#
# The CLI sandbox prevented the agent from committing inline, so the nine
# features are staged as one atomic v0.6.0 commit plus a tag. If you want
# nine separate commits, see the commit-message templates at the bottom.

set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Run the tests one more time before anything is committed.
pnpm test

# 2. Commit and tag.
git add -A
git -c user.name="sarmakska" -c user.email="60353896+sarmakska@users.noreply.github.com" \
  commit -m "release: v0.6.0 - 9 quality-of-life features

- map watcher with --watch-map flag on observe and dashboard
- forecastTokens with statusline and dashboard surface
- slipstream export <session> --out replay.zip
- configurable redaction via .claude/slipstream/redact.json
- doctor one-line fixes for the five common failure modes
- hook latency budget guard with SLIPSTREAM_HOOK_BUDGET_MS
- per-skill stats: 'slipstream stats --by-skill' and /api/stats/by-skill
- 'slipstream observe --ci' emits JSON lines for GitHub Actions
- drift detection on keyed observations

192 tests passing. See CHANGELOG.md for full notes."

git tag -a v0.6.0 -m "v0.6.0"
git push origin main
git push origin v0.6.0

#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
OLD_TITLE="Inden""ture"
OLD_UPPER="INDEN""TURE"
OLD_LOWER="inden""ture"
OLD_BRAND_TITLE="Ve""il"
OLD_BRAND_UPPER="VE""IL"
OLD_BRAND_LOWER="ve""il"
EXPECTED_TESTS="${EXPECTED_CLOISTRA_TESTS:-39}"

cd "$REPO_ROOT"

echo "== CLOISTRA gate: old-name scan =="
if grep -RIn -E "$OLD_TITLE|$OLD_UPPER|$OLD_LOWER|$OLD_BRAND_TITLE|$OLD_BRAND_UPPER|$OLD_BRAND_LOWER" \
  --exclude=pnpm-lock.yaml \
  --exclude=next-dev.log \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dependencies \
  --exclude-dir=out \
  --exclude-dir=cache \
  --exclude-dir=broadcast \
  .; then
  echo "CLOISTRA gate failed: tracked source still contains the old name." >&2
  exit 1
fi

echo "== CLOISTRA gate: forge build =="
(
  cd packages/foundry
  forge build --sizes
)

echo "== CLOISTRA gate: forge test =="
test_log="$(mktemp)"
trap 'rm -f "$test_log"' EXIT
(
  cd packages/foundry
  forge test -vv
) | tee "$test_log"

if ! grep -Eq "Ran [0-9]+ test suites .*: ${EXPECTED_TESTS} tests passed, 0 failed, 0 skipped \\(${EXPECTED_TESTS} total tests\\)" "$test_log"; then
  echo "CLOISTRA gate failed: expected exactly ${EXPECTED_TESTS} passing Foundry tests." >&2
  exit 1
fi

echo "== CLOISTRA gate: frontend typecheck =="
pnpm --filter ./packages/nextjs check-types

echo "== CLOISTRA gate: off-ramp typecheck =="
pnpm --filter @cloistra/offramp check-types

echo "== CLOISTRA gate: prettier =="
pnpm exec prettier --check .

echo "== CLOISTRA gate: passed =="

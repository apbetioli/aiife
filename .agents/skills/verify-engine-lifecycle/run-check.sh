#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

JAR_DIR="${HOME}/.local/share/tla2tools"
JAR_PATH="${TLA2TOOLS:-${JAR_DIR}/tla2tools.jar}"

if [[ ! -f "${JAR_PATH}" ]]; then
  echo "==> Downloading tla2tools.jar (v1.7.4)..."
  mkdir -p "${JAR_DIR}"
  curl -sSL "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar" -o "${JAR_PATH}"
fi

export TLA2TOOLS="${JAR_PATH}"

OUT_DIR="${1:-${REPO_ROOT}/artifacts/verify-engine-lifecycle}"
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

echo "==> Running TLC model check via statechart..."
set +e
"${REPO_ROOT}/.agents/skills/statechart/scripts/statechart" \
  "${SCRIPT_DIR}/EngineLifecycle.tla" \
  --config "${SCRIPT_DIR}/EngineLifecycle.cfg" \
  --view "${SCRIPT_DIR}/view.js" \
  --out "${OUT_DIR}"
STATECHART_EXIT=$?
set -e

echo ""
echo "==> Running TypeScript live engine reproduction test..."
node --import tsx "${SCRIPT_DIR}/repro-findings.ts"

echo ""
echo "==> Output written to: ${OUT_DIR}"
if [[ -f "${OUT_DIR}/report.md" ]]; then
  echo "--- report.md ---"
  cat "${OUT_DIR}/report.md"
fi

exit 0

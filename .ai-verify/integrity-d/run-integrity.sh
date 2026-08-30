#!/usr/bin/env bash
# Sub-D Task 7 — Jest integrity runner (5 suites, Postgres vellum_db).
# Reproducible standalone runner. Sets DATABASE_URL explicitly for real
# Postgres at 127.0.0.1:5432 vellum_db (trust auth).
#
# Usage:   bash .ai-verify/integrity-d/run-integrity.sh
# Outputs: run.log (in this dir) + exit 0 on 5/5 PASS

set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="${ROOT_DIR}/packages/api"
ARTIFACT_DIR="${ROOT_DIR}/.ai-verify/integrity-d"
LOG_FILE="${ARTIFACT_DIR}/run.log"

# Shell prefix (nvm) — if nvm.sh is available, source it; otherwise skip.
if [ -f "${HOME}/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
fi

cd "${API_DIR}" || { echo "ERROR: api dir not found ${API_DIR}"; exit 2; }

# Ensure prisma client generated
echo "[integrity-d] prisma generate..."
npx prisma generate >/dev/null 2>&1 || {
  echo "WARN: prisma generate failed, continuing anyway." >&2
}

export DATABASE_URL='postgresql://mcdarsenemwale@127.0.0.1:5432/vellum_db?schema=public'

echo "[integrity-d] Running Jest 5 integrity suites (rootDir=. with shims)..."
echo "[integrity-d] Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Run Jest with same T2/T3 JSON override pattern: rootDir="." so it sees
# __tests__/integrity/ dir, and moduleNameMapper shims for schedule/event-emitter.
# Use tee so stdout captures to run.log AND appears on console.
npx jest \
  __tests__/integrity \
  --rootDir='.' \
  --moduleNameMapper='{"@nestjs/event-emitter": "<rootDir>/__tests__/_shims_nestjs_event_emitter.cjs", "@nestjs/schedule": "<rootDir>/__tests__/_shims_nestjs_schedule.cjs"}' \
  --testTimeout=60000 \
  --forceExit \
  --detectOpenHandles \
  2>&1 | tee "${LOG_FILE}"

JEST_EXIT=${PIPESTATUS[0]}

echo ""
echo "==================================================================="
echo " [integrity-d] Jest EXIT=${JEST_EXIT}"
echo " [integrity-d] Log: ${LOG_FILE}"
echo "==================================================================="

tail -10 "${LOG_FILE}"
exit ${JEST_EXIT}

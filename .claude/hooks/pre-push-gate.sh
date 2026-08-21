#!/bin/bash
# pre-push-gate — PreToolUse (Bash) hook
# Blocks git push if typecheck or tests fail. Gracefully degrades:
# only runs checks whose config files exist.
#
# Escape hatch: SKIP_GATE=1 allows push with a logged warning.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('tool_input',{}).get('command',''))" 2>/dev/null)

if ! echo "$COMMAND" | grep -q "git push"; then
  echo '{"decision":"allow"}'
  exit 0
fi

if [ "${SKIP_GATE:-0}" = "1" ] || echo "$COMMAND" | grep -q "SKIP_GATE=1"; then
  echo "$(date -Iseconds) $(pwd)" >> .claude/gate-skips.log
  echo '{"decision":"allow","reason":"⚠️ SKIP_GATE=1 — pre-push gate bypassed. Logged to .claude/gate-skips.log"}'
  exit 0
fi

FAILURES=""

if [ -f "tsconfig.json" ]; then
  TSC_OUT=$(npx tsc --noEmit 2>&1)
  if [ $? -ne 0 ]; then
    TAIL=$(echo "$TSC_OUT" | tail -20)
    FAILURES="${FAILURES}TypeCheck failed:\n${TAIL}\n\n"
  fi
fi

if [ -f "package.json" ] && grep -q '"vitest"' package.json 2>/dev/null; then
  TEST_FILES=$(find src -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | head -1)
  if [ -n "$TEST_FILES" ]; then
    TEST_OUT=$(npx vitest run 2>&1)
    if [ $? -ne 0 ]; then
      TAIL=$(echo "$TEST_OUT" | tail -20)
      FAILURES="${FAILURES}Vitest failed:\n${TAIL}\n\n"
    fi
  fi
fi

if command -v deno &>/dev/null; then
  DENO_TESTS=$(find supabase/functions -name "*.test.ts" 2>/dev/null | head -1)
  if [ -n "$DENO_TESTS" ]; then
    DENO_OUT=$(deno test supabase/functions/ 2>&1)
    if [ $? -ne 0 ]; then
      TAIL=$(echo "$DENO_OUT" | tail -20)
      FAILURES="${FAILURES}Deno tests failed:\n${TAIL}\n\n"
    fi
  fi
fi

if [ -n "$FAILURES" ]; then
  ESCAPED=$(echo -e "$FAILURES" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' | sed 's/^"//;s/"$//')
  echo "{\"decision\":\"block\",\"reason\":\"${ESCAPED}\"}"
else
  echo '{"decision":"allow"}'
fi

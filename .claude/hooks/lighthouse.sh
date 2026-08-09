#!/bin/bash
# lighthouse — Multi-lifecycle hook
# POSTs Claude Code lifecycle events to Lighthouse dashboard (port 3032)
# Fire-and-forget: never blocks Claude, fails silently if server is down

LIGHTHOUSE_PORT="${LIGHTHOUSE_PORT:-3032}"

hook_data=$(cat)

EVENT=$(echo "$hook_data" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('hook_event_name',''))" 2>/dev/null)

PROJECT=$(basename "$(pwd)")
ENRICHED=$(echo "$hook_data" | python3 -c "
import json, sys, os
d = json.loads(sys.stdin.read())
d['project'] = os.path.basename(os.getcwd())
print(json.dumps(d))
" 2>/dev/null)

curl -s -X POST \
  "http://localhost:${LIGHTHOUSE_PORT}/api/events" \
  -H "Content-Type: application/json" \
  -d "$ENRICHED" \
  --connect-timeout 1 \
  --max-time 1 \
  >/dev/null 2>&1 &

case "$EVENT" in
  Stop) echo '{"continue": true}' ;;
  PreToolUse) echo '{"decision": "allow"}' ;;
  *) echo '{}' ;;
esac

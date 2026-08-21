#!/bin/bash
# status-digest — Stop hook
# Single-line status: context usage, session cost, and docs-changed flag.
# Replaces: context-window.sh, cost-tracker.sh, docs-review-reminder.sh

hook_data=$(cat)

python3 - "$hook_data" << 'PYTHON'
import json, sys, os

CONTEXT_LIMIT = 200_000
PRICING = {"input": 15.0, "output": 75.0, "cache_write": 18.75, "cache_read": 1.5}

hook_data_raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
try:
    hook = json.loads(hook_data_raw)
    transcript_path = hook.get("transcript_path", "")
    session_id = hook.get("session_id", "unknown")
except Exception:
    transcript_path = ""
    session_id = "unknown"

if not transcript_path or not os.path.exists(transcript_path):
    print('{"continue": true}')
    sys.exit(0)

last_context = 0
state_file = f"/tmp/claude-cost-{session_id}.json"
last_line = 0
try:
    if os.path.exists(state_file):
        with open(state_file) as f:
            last_line = json.load(f).get("last_line", 0)
except Exception:
    pass

totals = {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0}
current_line = 0

try:
    with open(transcript_path) as f:
        for line in f:
            current_line += 1
            try:
                entry = json.loads(line.strip())
                if "message" in entry and isinstance(entry["message"], dict):
                    usage = entry["message"].get("usage", {})
                    if usage:
                        inp = usage.get("input_tokens", 0)
                        cr = usage.get("cache_read_input_tokens", 0)
                        cw = usage.get("cache_creation_input_tokens", 0)
                        last_context = inp + cr + cw
                        if current_line > last_line:
                            totals["input"] += inp
                            totals["output"] += usage.get("output_tokens", 0)
                            totals["cache_write"] += cw
                            totals["cache_read"] += cr
            except Exception:
                continue
except Exception:
    print('{"continue": true}')
    sys.exit(0)

try:
    with open(state_file, "w") as f:
        json.dump({"last_line": current_line}, f)
except Exception:
    pass

if last_context == 0:
    print('{"continue": true}')
    sys.exit(0)

pct = last_context / CONTEXT_LIMIT
if pct >= 0.85:
    ctx_icon = "\U0001f534"
elif pct >= 0.70:
    ctx_icon = "\U0001f7e1"
else:
    ctx_icon = "\U0001f7e2"

total_cost = sum((totals[k] / 1_000_000) * PRICING[k] for k in PRICING)

docs_flag = ""
marker = "/tmp/project-docs-reviewed"
src_dir = "src" if os.path.isdir("src") else None
if src_dir:
    import subprocess
    if os.path.exists(marker):
        result = subprocess.run(
            ["find", src_dir, "-name", "*.ts", "-not", "-name", "*.test.ts", "-newer", marker],
            capture_output=True, text=True
        )
        if result.stdout.strip():
            docs_flag = " | docs?"
            open(marker, "a").close()
            os.utime(marker, None)
    else:
        open(marker, "w").close()

msg = f"[ctx {ctx_icon} {pct:.0%} | ${total_cost:.2f}{docs_flag}]"
escaped = json.dumps(msg)
print(f'{{"continue": true, "systemMessage": {escaped}}}')
PYTHON

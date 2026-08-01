# Claude CLI Error

**Category:** bug
**Status:** pending
**Phase:** 4
**Priority:** P3

## User's Original Request
> Getting this error when trying to create a new claude instance:
> TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".exe" for /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe

## Diagnosis
This is a Node.js v23.1.0 compatibility issue, not app code. Node 23.x has stricter ESM module loading that rejects unknown file extensions. The Claude Code binary at `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe` has a `.exe` extension that Node's ESM loader doesn't recognize on macOS.

No `.nvmrc` file exists to pin Node version. No `engines` field in package.json.

**Root cause:** Node v23.1.0 incompatibility with Claude Code's binary format. Need stable LTS Node version.

**Files involved:**
- `.nvmrc` — create with LTS version (20 or 22)
- `package.json` — add engines field
- User action: `nvm install 22 && nvm use 22`

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Create `.nvmrc` with `22` (current LTS)
  2. Add `"engines": { "node": ">=20 <23" }` to package.json
  3. Instruct user to run `nvm install 22 && nvm use 22`
  4. Reinstall Claude Code if needed: `npm install -g @anthropic-ai/claude-code`
- **Files:** .nvmrc, package.json
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** verify Claude CLI starts → verify app builds
- **Tests:** manual — run `claude` command, run `npm run build`
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** confirm `node --version` shows v22.x, `claude` starts without error
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Claude CLI throws ERR_UNKNOWN_FILE_EXTENSION |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |

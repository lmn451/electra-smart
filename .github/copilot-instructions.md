# GitHub Copilot Instructions for Electra Control PWA

## Project Overview

**Electra Control PWA** is a Progressive Web App for controlling Electra Smart air conditioning units. Built with vanilla JavaScript and deployed on Cloudflare Pages with serverless functions. We use **bd (beads)** for all task tracking.

**Key Features:**
- Full PWA with offline support and installability
- OTP-based authentication (no passwords)
- Real-time AC control (temperature, mode, fan speed, etc.)
- Service Worker caching for instant loads
- Mobile-first responsive design

## Tech Stack

- **Language**: Vanilla JavaScript (ES6+)
- **Frontend**: HTML5, CSS3
- **Backend**: Cloudflare Pages Functions (serverless)
- **Deployment**: Cloudflare Pages
- **Build Tool**: Wrangler
- **Package Manager**: pnpm

## Coding Guidelines

### JavaScript Style
- Use vanilla JavaScript (no frameworks)
- ES6+ features (async/await, destructuring, arrow functions)
- Avoid global variables (use modules or IIFE patterns)
- Use template literals for HTML generation
- Follow existing patterns in `app.js`

### API Development
- All endpoints in `functions/api/`
- Export `onRequestGet`, `onRequestPost`, etc.
- Use electra.js client functions for upstream API calls
- Always validate X-Electra-IMEI and X-Electra-Token headers
- Return JSON with proper error handling

### PWA Best Practices
- Update BUILD_ID in service-worker.js when changing cached assets
- Add new static assets to APP_SHELL array
- Keep navigation network-first, static assets cache-first
- Test offline functionality

### Git Workflow
- Commit `.beads/issues.jsonl` with code changes
- Write clear commit messages
- Keep commits atomic and focused

## Issue Tracking with bd

**CRITICAL**: This project uses **bd** for ALL task tracking. Do NOT create markdown TODO lists.

### Essential Commands

```bash
# Find work
bd ready --json                    # Unblocked issues
bd stale --days 30 --json          # Forgotten issues

# Create and manage
bd create "Title" -t bug|feature|task -p 0-4 --json
bd create "Subtask" --parent <epic-id> --json  # Hierarchical subtask
bd update <id> --status in_progress --json
bd close <id> --reason "Done" --json

# Search
bd list --status open --priority 1 --json
bd show <id> --json

# Sync (CRITICAL at end of session!)
bd sync  # Force immediate export/commit/push
```

### Workflow

1. **Check ready work**: `bd ready --json`
2. **Claim task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** `bd create "Found bug" -p 1 --deps discovered-from:<parent-id> --json`
5. **Complete**: `bd close <id> --reason "Done" --json`
6. **Sync**: `bd sync` (flushes changes to git immediately)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

## Project Structure

```
electra/
├── index.html           # Main HTML (313 lines)
├── app.js               # Core app logic (950 lines)
├── styles.css           # Styling (956 lines)
├── service-worker.js    # PWA service worker
├── manifest.webmanifest # PWA manifest
├── functions/
│   └── api/
│       ├── _lib/
│       │   └── electra.js    # Electra API client
│       ├── auth/
│       │   ├── start.js      # OTP send endpoint
│       │   └── verify.js     # OTP verify endpoint
│       ├── devices.js        # List devices
│       ├── command.js        # Send commands
│       ├── power.js          # Power control
│       ├── health.js         # Health check
│       └── status/
│           └── [ac_id].js    # Device status
├── icons/               # PWA icons (various sizes)
└── openapi.yaml        # API specification
```

## Available Resources

### Scripts
- `pnpm dev` - Start local development server
- `pnpm deploy` - Deploy to Cloudflare Pages

### Key Documentation
- **AGENTS.md** - Comprehensive AI agent guide (detailed workflows, advanced features)
- **README.md** - User-facing documentation
- **PWA-GUIDE.md** - PWA best practices and troubleshooting
- **REFACTOR_OPTIONS.md** - Analysis of refactoring approaches
- **openapi.yaml** - Complete API specification

## CLI Help

Run `bd <command> --help` to see all available flags for any command.
For example: `bd create --help` shows `--parent`, `--deps`, `--assignee`, etc.

## Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Run `bd sync` at end of sessions
- ✅ Run `bd <cmd> --help` to discover available flags
- ✅ Test locally with `pnpm dev` before deploying
- ✅ Update BUILD_ID when changing cached assets
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT commit `.beads/beads.db` (JSONL only)
- ❌ Do NOT cache API responses in service worker
- ❌ Do NOT store credentials in code

---

**For detailed workflows and advanced features, see [AGENTS.md](../AGENTS.md)**

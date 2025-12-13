# Electra Control PWA - Agent Instructions

## Project Overview

This is a **Progressive Web App (PWA)** for controlling Electra Smart air conditioning units. Built with vanilla JavaScript and deployed on Cloudflare Pages with serverless functions.

**Key Features:**
- Full PWA with offline support and installability
- OTP-based authentication (no passwords)
- Real-time AC control (temperature, mode, fan speed, etc.)
- Service Worker caching for instant loads
- Mobile-first responsive design

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Cloudflare Pages Functions (serverless)
- **Deployment**: Cloudflare Pages
- **Build Tool**: Wrangler
- **Package Manager**: pnpm

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
├── tests/              # Test directory structure
└── openapi.yaml        # API specification
```

## Development Workflow

**Local Development:**
```bash
pnpm install
pnpm dev  # Starts wrangler pages dev server
```

**Deployment:**
```bash
pnpm deploy  # Deploys to Cloudflare Pages
```

## Architecture Notes

### Authentication Flow
1. User enters phone number → `/api/auth/start` (generates IMEI, sends OTP)
2. User enters code → `/api/auth/verify` (validates OTP, returns token)
3. All API calls require headers: `X-Electra-IMEI` and `X-Electra-Token`
4. SID (session ID) is cached server-side per IMEI+token pair (60s TTL)

### Service Worker Strategy
- **Static assets**: Cache-first (app shell: CSS, JS, icons)
- **HTML/Navigation**: Network-first (always fresh, fallback to offline page)
- **API calls**: Network-only (no caching of device state)
- **Cache key**: BUILD_ID in service-worker.js (triggers updates)

### State Management
- Credentials stored in sessionStorage (or localStorage if "Remember me")
- Device state fetched on-demand (no persistent client-side cache)
- Optimistic UI updates with reconciliation

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
bd create "Subtask" --parent <epic-id> --json  # Hierarchical subtask (gets ID like epic-id.1)
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the code changes so issue state stays in sync with code state

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### GitHub Copilot Integration

If using GitHub Copilot, also create `.github/copilot-instructions.md` for automatic instruction loading.
Run `bd onboard` to get the content, or see step 2 of the onboard instructions.

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):
```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:
- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**
- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**
```
# AI planning documents (ephemeral)
history/
```

**Benefits:**
- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### CLI Help

Run `bd <command> --help` to see all available flags for any command.
For example: `bd create --help` shows `--parent`, `--deps`, `--assignee`, etc.

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ✅ Run `bd <cmd> --help` to discover available flags
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

For more details, see README.md and QUICKSTART.md.

## Key Files to Know

- **app.js**: Main application logic, device rendering, API calls
- **electra.js**: Backend API client with SID caching and OTP flows
- **service-worker.js**: PWA caching strategies, update handling
- **openapi.yaml**: Complete API specification
- **PWA-GUIDE.md**: PWA best practices and troubleshooting
- **REFACTOR_OPTIONS.md**: Analysis of refactoring approaches (HTML templates chosen)

## Common Tasks

**Adding a new API endpoint:**
1. Create file in `functions/api/`
2. Export `onRequestGet` or `onRequestPost`
3. Use electra.js client functions
4. Update openapi.yaml

**Updating PWA cache:**
1. Modify APP_SHELL array in service-worker.js
2. Update BUILD_ID to trigger updates

**Styling changes:**
1. Edit styles.css (uses CSS custom properties/variables)
2. Mobile-first approach (640px, 768px, 1024px breakpoints)

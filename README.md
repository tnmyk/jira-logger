# Jira Logger

Local Jira time-logging utility. Clone, run the dev server, connect your Jira Cloud account, and log time without hunting through Jira.

Built for developers who each run their own copy. There is no deployment, app login, session store, database, or server-side user state.

## Requirements

- Node.js 22.23.4 or newer
- A Jira Cloud account
- A Jira API token: <https://id.atlassian.com/manage-profile/security/api-tokens>

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Astro. The default is <http://localhost:3000>.

For the same server with `.env` support and foreground process handling:

```bash
npm run start
```

The dev server binds `127.0.0.1` by default. To expose it on the LAN:

```bash
npm run dev:lan
```

Only do that on a trusted network. The Jira token travels over plain HTTP when the app is opened by another machine.

If the Astro dev server is running in the background:

```bash
npm run dev:status
npm run dev:logs
npm run dev:stop
```

## Run on boot (Rocky Linux)

The UI and the Jira proxy are one Astro process. There is no separate app server to start.

The installer creates a **systemd user service**, enables it, and tries to enable lingering so it starts when the machine boots:

```bash
npm install
./scripts/install-service.sh
```

If the installer could not enable lingering, run this once:

```bash
sudo loginctl enable-linger "$USER"
```

Lingering lets the user service start at boot without requiring a desktop login.

Useful commands:

```bash
systemctl --user status jira-logger
systemctl --user restart jira-logger
systemctl --user stop jira-logger
journalctl --user -u jira-logger -f
```

The default URL is <http://127.0.0.1:3000>. The installer creates `.env` from `.env.example`; change `HOST` or `PORT` there and restart the service.

For access from another machine, prefer an SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 user@your-rocky-host
```

Then open <http://127.0.0.1:3000> locally. If you must expose the port directly, set `HOST=0.0.0.0` in `.env`, open the port in `firewalld`, and use only a trusted network. This is a development server over plain HTTP, not a production deployment.

After updating the app:

```bash
git pull
npm install
systemctl --user restart jira-logger
```

If Node.js is managed by `nvm`, rerun `./scripts/install-service.sh` after switching Node versions so the service picks up the new `PATH`.

Remove the service with:

```bash
./scripts/uninstall-service.sh
```

The mock Jira server is not part of this service; start it separately with `npm run mock` when testing.

## Connect Jira

On first run, enter:

- Jira site: `https://your-domain.atlassian.net`
- Email: your Atlassian account email
- API token: the token created above

The token is stored in this browser's `localStorage`. It is sent to the local Astro proxy only when calling Jira. No cookie or login session is created.

## What it does

**Today**
- Fixed/admin tickets get one-click quick-log buttons with their own duration and comment.
- Pinned and recent tickets get quick duration buttons.
- Quick log creates the worklog immediately and offers **Undo**.
- **Fill day** logs several tickets in one pass with per-ticket duration and comment.
- Logged-today list with delete actions.

**Week**
- Navigate previous/next weeks.
- See per-day totals against a configurable working-day target.
- Missing-day and under-target summary.
- Backfill any past day with ticket suggestions, start time, duration, comment, `Log & another`, and **Undo**.
- Mark local days off; week target recalculates.
- Copy selected entries from the previous week, previewed before writing.
- Future target days are disabled during copy.

**Search**
- JQL, ticket key (`ABC-123`), or plain words (summary/text search).
- Start from `My open` or `All open`.
- Pin tickets; pinning a fixed ticket is blocked to avoid duplicates.
- Log time from the detail panel; delete recent worklogs from Today/Week/detail.

**General**
- Jira timezone-aware dates and start times.
- Delete your own recent worklogs.
- Everything is stored per browser.

## Keyboard

- `t` — Today
- `w` — Week
- `/` — Search / focus JQL
- `j` / `k` — move through search results
- `l` — focus the log-time form for the selected ticket
- `p` — pin/unpin the selected ticket
- `f` — open Fill day (Today)
- `u` — undo the last log/backfill/batch/copy
- `Cmd/Ctrl+Enter` — submit a worklog / Fill day
- `Esc` — close panel/dialog or blur field

## Settings

Open **Settings** from the sidebar or header.

- Default JQL
- Backfill start time (today’s logs use the current time)
- Quick durations in minutes
- Week start day
- Estimate behavior (Reduce remaining estimate is on by default)
- Watcher notifications
- Daily target on working days
- Show weekends
- Default duration and default comment
- Fixed tickets: key, minutes, optional comment
- Jira connection info / disconnect

All settings live in `localStorage`. There is no server-side persistence.

## Jira API behavior

The browser cannot call Jira REST directly because Jira does not allow CORS. Astro API routes act as a small stateless proxy.

- Jira Cloud only
- Auth: Basic `email:apiToken`
- Search: `/rest/api/3/search/jql`
- Worklogs: `/rest/api/3/issue/{key}/worklog`
- Comments: Atlassian Document Format (ADF)
- Pins, fixed tickets, filters, and preferences: browser `localStorage`
- No team-field filter; use JQL for any team-specific query
- No timer; manual duration logging only

The proxy validates the Jira URL, forwards the auth header, maps Jira errors, and never logs the token.

## Mock Jira

Useful for UI work and smoke tests.

```bash
npm run mock
```

In another terminal, run the app and connect with:

- Jira site: `http://localhost:4000`
- Email: `dev@example.com`
- API token: `token`

The mock supports search, issue lookup, worklog create/delete, and weekly summaries.

## Tests

```bash
npm run check
npm test
```

End-to-end smoke test (requires `npm run mock` and `npm run dev` running):

```bash
npm run smoke
```

Screenshots for visual review (requires `npm run mock` and `npm run dev` running):

```bash
npm run screenshots
```

Screenshots are written to `.artifacts/ui/`.

## Security

This is a local utility. The Jira token has whatever permissions your account has, including writing worklogs.

- Keep the dev server on localhost or a trusted network.
- Do not expose it publicly over plain HTTP.
- The token lives in `localStorage`, so XSS matters. The app uses React escaping, a strict layout, and no third-party scripts, but treat browser extensions and injected scripts as risks.
- If you need remote access, use an SSH tunnel or a trusted private network.

## Not included

- Deployment, Docker, Lambda, or EC2 setup
- App accounts, cookies, sessions, or CSRF layer
- Database or shared team configuration
- Jira Server/Data Center
- Team-field filter
- Editing existing worklogs (delete and re-add instead)
- Start/stop timer
- Reports, approvals, or Tempo integration

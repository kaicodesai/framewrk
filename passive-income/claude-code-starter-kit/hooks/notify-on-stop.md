# Hook: Notify on Stop

A `Stop` hook that fires a desktop notification (or a webhook, e.g. to Slack/Discord) whenever
Claude finishes responding — useful for long-running sessions where you've tabbed away and want
to know the moment it's done instead of polling the window.

## Option A — local desktop notification

Save as `.claude/hooks/notify-on-stop.sh`:

```bash
#!/usr/bin/env bash
# Cross-platform best-effort desktop notification. Silently no-ops on
# platforms/headless environments with neither tool available.
if command -v notify-send >/dev/null 2>&1; then
  notify-send "Claude Code" "Session finished — ready for you."
elif command -v osascript >/dev/null 2>&1; then
  osascript -e 'display notification "Session finished — ready for you." with title "Claude Code"'
fi
exit 0
```

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/notify-on-stop.sh"
          }
        ]
      }
    ]
  }
}
```

## Option B — webhook (Slack/Discord/generic)

Save as `.claude/hooks/notify-on-stop-webhook.sh` and set `CLAUDE_NOTIFY_WEBHOOK_URL` in your
shell environment (never hardcode the URL in the script itself):

```bash
#!/usr/bin/env bash
[ -z "$CLAUDE_NOTIFY_WEBHOOK_URL" ] && exit 0
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"text":"Claude Code session finished — ready for you."}' \
  "$CLAUDE_NOTIFY_WEBHOOK_URL" >/dev/null 2>&1
exit 0
```

## Notes

- `Stop` hooks fire every time Claude finishes a turn, not just at the end of a long task — if
  that's too chatty for your workflow, only enable this in sessions where you're deliberately
  stepping away, or gate the webhook variant behind an env var you set per-session.
- Keep the webhook URL out of version control — read it from an environment variable, exactly
  as shown, not a literal string in the script.

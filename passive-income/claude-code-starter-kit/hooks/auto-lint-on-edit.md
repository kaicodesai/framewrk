# Hook: Auto-Lint on Edit

A `PostToolUse` hook that runs your project's formatter/linter automatically on any file Claude
just edited or wrote, so formatting drift never accumulates across a session and never has to
be a manual step you remember to do.

## 1. Add the runner script

Save as `.claude/hooks/auto-lint-on-edit.sh`:

```bash
#!/usr/bin/env bash
# Reads the tool call JSON from stdin, extracts the file_path, and runs the
# project's formatter on just that file. Adjust the case statement to your
# project's actual toolchain — this is a template, not a universal answer.
input=$(cat)
file=$(echo "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"(.*)"/\1/')

[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx)
    npx --no-install prettier --write "$file" 2>/dev/null
    npx --no-install eslint --fix "$file" 2>/dev/null
    ;;
  *.py)
    ruff format "$file" 2>/dev/null
    ruff check --fix "$file" 2>/dev/null
    ;;
  *.rs)
    rustfmt "$file" 2>/dev/null
    ;;
  *.go)
    gofmt -w "$file" 2>/dev/null
    ;;
esac
exit 0
```

## 2. Wire it into settings.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/auto-lint-on-edit.sh"
          }
        ]
      }
    ]
  }
}
```

## Notes

- Keep this fast — it runs after every single edit, so a slow formatter noticeably slows down a
  session. Scope commands to the single file, not the whole project.
- Exit `0` unconditionally on the happy path; a `PostToolUse` hook failing loudly on an
  unformattable file (e.g. a JSON5/config file your formatter doesn't understand) just adds
  noise. Redirect stderr as shown above rather than letting the hook itself error out.
- If your project already runs formatting in a pre-commit hook or CI, this is a complement, not
  a replacement — it just means the diff is already clean before it ever reaches git.

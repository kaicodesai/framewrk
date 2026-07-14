# Hook: Block Dangerous Commands

A `PreToolUse` hook that inspects every `Bash` call before it runs and blocks a short list of
high-blast-radius commands (`rm -rf` on broad paths, `git push --force` to `main`/`master`,
`git reset --hard`, `git clean -f`) unless the human explicitly allows it in that turn.

This does not replace judgment — it's a last-line safety net for the moment an agent is about
to run something destructive on autopilot.

## 1. Add the checker script

Save as `.claude/hooks/block-dangerous-commands.sh` in your project and `chmod +x` it:

```bash
#!/usr/bin/env bash
# Reads the tool call JSON from stdin, exits 2 (block) with a reason on stderr
# if the command matches a known-destructive pattern.
input=$(cat)
command=$(echo "$input" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"(.*)"/\1/')

deny() {
  echo "Blocked by block-dangerous-commands hook: $1" >&2
  exit 2
}

case "$command" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf ."*) deny "broad recursive delete" ;;
  *"git push --force"*"main"*|*"git push -f"*"main"*|*"git push --force"*"master"*) deny "force push to main/master" ;;
  *"git reset --hard"*) deny "git reset --hard discards uncommitted work" ;;
  *"git clean -f"*) deny "git clean -f permanently deletes untracked files" ;;
  *) exit 0 ;;
esac
```

## 2. Wire it into settings.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/block-dangerous-commands.sh"
          }
        ]
      }
    ]
  }
}
```

## Notes

- Exit code `2` on a `PreToolUse` hook blocks the tool call and returns the stderr message to
  the model, so it can explain to the user why it stopped instead of silently failing.
- The pattern list above is deliberately short and literal — false negatives are safer to accept
  than false positives that block legitimate work. Extend the `case` block for your own repo's
  known-risky commands (e.g. a deploy script, a database migration command).
- This is a safety net, not a substitute for reviewing what an agent is about to do — pair it
  with normal permission prompts, don't rely on it alone.

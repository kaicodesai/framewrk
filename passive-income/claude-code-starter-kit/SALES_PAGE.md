# Gumroad listing copy (copy/paste starting point)

Everything below is a draft — edit the price and tone to match your own voice before publishing.
Suggested price: **$25** one-time. Keep it a single price point at launch — a $39 "team" tier
granting the same files under an internal-multi-seat license is a reasonable upsell to add
later once you have real conversion data, not something to guess at up front.

---

## Title

**Agent Ops Starter Kit — Skills, Subagents & Hooks for Claude Code**

## Subtitle

Six workflow skills, three subagents, and three safety/automation hooks your Claude Code setup
doesn't ship with — install in five minutes, own the files forever.

## Description

If you use Claude Code for real engineering work, you've probably hit the same gaps: it'll
happily bulk-upgrade every dependency at once, it won't tell you which of your exported
functions have zero test coverage, and there's no seatbelt stopping it from running `git reset
--hard` on autopilot.

This kit is six skills, three subagents, and three hooks that close those gaps — written as
plain Markdown/JSON config files you drop into `.claude/`, not a plugin or an account you have
to manage.

**What's inside:**

- **Dependency Upgrade Planner** — stops blind `npm update`-style bulk bumps; ranks upgrades by
  risk and flags security advisories first
- **Test Gap Finder** — finds untested exports and scaffolds honest test stubs, never a fake
  passing assertion
- **License Compliance Scan** — flags copyleft/unlicensed dependencies before they become a
  legal problem
- **Changelog From Commits** + **Conventional Commit Lint** — clean release notes and commit
  hygiene without typing them by hand
- **Onboarding Doc Generator** — a CONTRIBUTING.md grounded in your repo's actual setup, not a
  generic template
- **3 subagents** — `migration-planner` (plans framework/API upgrades in safe phases),
  `doc-sync` (catches doc drift against real code behavior), `release-manager` (orchestrates
  version bump + changelog + tag, never pushes without asking)
- **3 hooks** — block destructive Bash commands, auto-format on every edit, get notified when a
  session finishes
- A starter `settings.json` wiring it all together with sane permission defaults

Every file is plain text you can read end-to-end before installing anything — nothing here
phones home, and nothing runs until you wire it into your own `.claude/` config.

**Who this is for:** developers already using Claude Code who want a more disciplined default
setup without writing it all from scratch.

**Who this isn't for:** if you've never used Claude Code before, start with Anthropic's own
docs first — this kit extends an existing workflow, it doesn't teach you the tool from zero.

## FAQ

**Does this require an API key or subscription beyond Claude Code itself?**
No. It's config files for a tool you already have.

**Will this work with [my language/stack]?**
The skills are language-agnostic in their reasoning; a few (the auto-lint hook, specifically)
have example commands for JS/TS, Python, Rust, and Go — edit the case statement for anything
else in about two minutes.

**Do I get updates?**
No update subscription is implied — see the license for what's included. If you want to
improve something, the files are yours to edit.

**Can I use this for client work?**
Yes — using the Kit to do paid work for your own clients is unrestricted. You just can't
resell the Kit's own files as a product. See `LICENSE.md`.

---

## Tags (for Gumroad discovery)

`claude code`, `ai coding agent`, `developer tools`, `productivity`, `automation`, `dev
workflow`, `subagents`, `llm tools`

## Pre-launch checklist (not part of the listing, just your notes)

- [ ] Read every file in the kit end-to-end once more before publishing — a product you haven't
      re-read yourself is a product you can't stand behind if a buyer asks a question.
- [ ] Zip the kit (see repo root `package.sh` if present, or zip manually) and upload as the
      Gumroad product file.
- [ ] Set the price and publish.
- [ ] One seed post in a relevant community (a subreddit like r/ClaudeAI, a relevant Discord, or
      X) linking the listing — this is the one manual step; after that, Gumroad + search
      discovery carries it.

# Lead Automation System — Build Brief for Codex

## How to use this document
This is a complete, self-contained build brief. Paste it directly into Codex
as the initial prompt. It contains the business context, the offer, the exact
system architecture, the reasoning behind every major decision, and the
concrete deliverables expected. Where a decision requires a human (API keys,
account creation, business judgment calls not covered below), it's flagged
explicitly — everything else, use your judgment and build it; the operating
principle for this entire system is **simplicity**. Prefer the smallest,
most boring implementation that works over anything clever.

---

## 1. What this system is for

Two founders (Kai and Nici) sell a productized $500 website rebuild to small
appointment-based wellness businesses. Today, finding prospects, qualifying
them, and reaching out is entirely manual. This system automates sourcing,
qualifying, and emailing prospects, and stops the moment a human is needed —
it does **not** build websites, take payment, or do anything past detecting
buying interest and alerting the founders. The actual client website build
is a separate, manual process the founders do themselves once a lead is
warm; it is out of scope for this system entirely.

**Explicit non-goals** (decided after discussion, do not reintroduce):
- No n8n or any visual workflow tool — orchestration is plain code triggered
  by a daily scheduled job.
- No SMS/WhatsApp/Twilio infrastructure — email only.
- No custom hosted dashboard/app — Notion is the entire UI/tracking layer.
- No speculative website generation for leads — nothing gets built until a
  human decides to, after a lead replies interested.
- No CRM/database beyond Notion — do not stand up Postgres/SQLite/etc.

If a design choice would add a new service, a new account type, or a new
piece of infrastructure beyond what's listed in §3, treat that as a signal
to find a simpler approach instead, not a reason to ask for approval.

---

## 2. Ideal client / qualification criteria

This is the qualification bar prospects must clear before being emailed.

**Prioritize:**
- Appointment-based wellness businesses (spas, massage, chiropractic,
  salons, med spas, yoga/wellness studios, similar).
- A real decision-maker can plausibly be identified (i.e., not a franchise
  location with no local purchasing authority).
- The current website (or lack of one) creates a visible improvement
  opportunity.
- A clearer offer or booking path can plausibly create business value for
  them.
- The business appears able to afford a $500 project (proxy: review count,
  rating, apparent business maturity — not a hard financial check).

**Nurture (good fit, not now):** no urgency, no response, timing is later,
or purchasing ability is unclear. Keep these out of active sequencing but
don't discard them.

**Disqualify:** no credible website-improvement case (site is already
modern and functional), ecommerce-first business model, suppressed/opted-
out contact, existing client conflict, or clearly unable to purchase.

**Important:** treat the automatic score as a first pass only. Before a
lead is actually queued for outreach, have an LLM step visually verify the
claimed problem (fetch the site, look at it) rather than trusting field
data alone. Don't skip this — it's also what keeps the email copy specific
instead of generic (see §5).

---

## 3. System architecture

```
Google Places API  →  Notion (single database, the system of record)
                          ↑↓
                     Hunter.io (email enrichment, has-website leads only)
                          ↑↓
                     Gmail (sending + reply polling)
                          ↓
                email alert to Kai + Nici on any "interested" reply
```

All of the above is orchestrated by **one script, run once a day by a
scheduled job**. No queueing system, no separate worker processes, no web
server. If it needs to run more than once a day for some sub-step, that's
fine, but keep the mental model to "one job, one daily run, does everything
in order."

### Required accounts/credentials (human-provided — do not attempt to create these)
- Google Maps Platform API key with the Places API enabled
- Hunter.io API key
- A Gmail account/alias dedicated to outreach (not the founders' primary
  inbox), with either Gmail API OAuth credentials or an SMTP app password
- A Notion integration token, and the ID of a parent page/workspace the
  integration can create the Leads database under
- Kai's and Nici's email addresses (for interest alerts)

Scaffold config for all of the above (e.g. a `.env.example` and a config
file) but don't hardcode secrets, and don't attempt to sign up for any of
these services yourself — ask the human to provide the values.

---

## 4. Data model — Notion "Leads" database

One row per business. Exact fields:

| Field | Type | Notes |
|---|---|---|
| Business Name | Title | |
| Phone | Text | **Required.** Any sourced business without a phone number is dropped before it ever becomes a row — see §5. |
| Website URL | URL | Blank if the business has none |
| Email | Email | Populated by enrichment; blank if none found |
| Category | Select | e.g. spa, chiropractor, massage, salon, med spa |
| Google Rating | Number | |
| Google Review Count | Number | |
| Google Place ID | Text | Used for dedupe on every sourcing run |
| Qualification Score | Number | First-pass automatic score |
| Qualification Notes | Text | Rationale, plus the outcome of the visual-verification step |
| Track | Select | `Email` or `Call List` — see §5 |
| Status | Select | `New`, `Scored`, `Ready to Send`, `Sequence Active`, `Replied – Interested`, `Nurture`, `Disqualified`, `Call List`, `Handed Off` |
| Sequence Stage | Number | 0–3 |
| Next Send Date | Date | |
| Last Contacted | Date | |
| Email Log | Text | Append-only, timestamped record of every send/reply for that lead |

This database is the entire tracking layer for both founders — no separate
CRM, no custom dashboard.

---

## 5. Daily pipeline — build this as the core script

Run in this order, every day:

1. **Source.** Query the Google Places API for the configured categories
   and geographies (make these configurable — start with whatever list Kai
   provides). For each result, fetch enough detail to get phone, website
   (if any), rating, review count. **Drop any result with no phone number
   immediately** — it never becomes a Notion row. Dedupe against existing
   rows by Google Place ID.

2. **Score.** Apply the qualification criteria in §2 as a first-pass
   automatic score (website absent/weak = higher priority; category match;
   review count as a maturity proxy). Write new rows to Notion with
   `Status = Scored`.

3. **Verify (LLM judgment step — don't skip this).** For scored leads that
   have a website, fetch it and have the LLM assess the specific problem
   (hard to book, no clear service info, dated design, etc.) before trusting
   the automatic score. Record the specific, concrete finding in
   Qualification Notes — this finding gets used verbatim in the email copy
   in step 5, which is what keeps outreach from reading as generic spam.

4. **Route and enrich.**
   - Has a website → look up a contact email via Hunter.io's domain
     search. Found → `Track = Email`. Not found → `Track = Call List`.
   - No website at all → `Track = Call List` directly, no Hunter lookup
     (there's no domain to search). This is expected and fine: businesses
     with no website are actually a *stronger* qualification signal, but
     they're less reachable by automated email, so they become a manual
     call list for Kai and Nici rather than something this system emails.
   - `Call List` leads get `Status = Call List` and nothing further
     automated happens to them — this system's job for that lead ends here.

5. **Draft (Email track only).** For any `Email`-track lead that's due for
   its next touch (new leads at stage 0, or `Next Send Date` = today),
   draft the appropriate email from the sequence (see §6) using the
   specific finding from step 3. Set `Status = Ready to Send`. **Do not
   send it yet.**

6. **Human checkpoint.** This is a deliberate safety step, not a
   nice-to-have — leave it as a manual approval gate, don't automate around
   it. Kai/Nici review the `Ready to Send` view in Notion and approve or
   discard each draft. Reasoning: the first sends define the sending
   domain's reputation, and a bad personalization (wrong business name, a
   broken merge field) sent unattended to a real business owner isn't
   reversible. Once a batch or two has gone out clean, the founders may
   choose to loosen this — but build it as a required gate by default.

7. **Send (approved only).** For leads marked approved, send via Gmail,
   append the send to Email Log, set `Status = Sequence Active`, advance
   `Sequence Stage`, and set `Next Send Date` to ~4-5 business days out.

8. **Reply check.** Poll the outreach mailbox for replies on sent threads.
   Classify each with the LLM: `Interested`, `Not Interested`,
   `Out of Office`, or `Opt-out` (a "STOP"/unsubscribe-style request — see
   §7). On `Interested`: set `Status = Replied – Interested`, append the
   reply to Email Log, **send an immediate email alert to Kai and Nici**
   with the lead's details and the reply text, and stop sequencing that
   lead entirely. On `Opt-out`: set `Status = Disqualified` and suppress
   all future sends for that lead, permanently.

9. **Sequence exhaustion.** A lead that completes all sequence stages with
   no reply moves to `Status = Nurture` and stops.

10. **Send cap.** Enforce a configurable daily send cap (start at 15-25)
    regardless of how large the `Ready to Send`/approved backlog is,
    prioritizing by Qualification Score descending. The backlog is expected
    to grow faster than the safe send rate — that's fine, sourcing and
    sending are intentionally decoupled. Do not raise this cap
    automatically; it's a deliverability safety valve, not a bug to fix.

---

## 6. The offer (what the email sequence sells)

**Audience reality check:** because of how enrichment works (§5, step 4),
the email sequence only ever reaches businesses that *already have* a
website — just a weak one. It will never reach true no-website businesses;
those are the manual call list. Write and build accordingly: the pitch is
**"your website is quietly costing you bookings,"** never "you need a
website" (which would be false for this audience).

**The product: Website Launch Sprint — $500 flat**
- One conversion-focused page, up to ~5 core sections
- Mobile-responsive
- Booking/appointment integration
- Contact form
- Basic on-page SEO (titles, meta descriptions, local SEO setup)
- Built from the client's existing logo, colors, photos, content
- One structured revision round included
- Domain connection, final handoff, full client ownership
- ~5 business days from when materials are received

**Not included** (fine-print, not lead copy): branding/logo design,
unlimited pages or revisions, ecommerce/membership systems, heavy
copywriting, workflow automation, ongoing maintenance, photography/asset
creation. Additional pages are a separate add-on price (not yet defined —
don't invent a number, leave a placeholder).

**Price framing:** state $500 flat, plainly. The comparison in a reader's
head at this price is "vs. doing nothing," not "vs. an agency" — don't
frame it any other way.

**Guarantee (important — the highest-leverage line in the email):** *"One
structured revision round included — if it's still not right, you don't
pay."* This is the risk-reversal that makes a stranger comfortable
replying to a cold email. Keep it in every draft of the sequence.

**Payment timing:** due on approval of the revised draft, not upfront
(reduces friction for a cold lead with zero prior relationship; the
guarantee above covers the downside). This system does not need to handle
payment at all — that happens later, manually, after handoff.

**The CTA is always "reply" — nothing else.** No booking link, no calendar
tool. E.g. "Reply YES and I'll tell you what I need" or "Reply and let me
know." This is a hard constraint, not a copy preference: it's what keeps
step 8 (reply classification) sufficient for detecting interest, with no
need to build calendar-link tracking or any other event source.

---

## 7. Email sequence structure

Three emails per lead, ~4-5 business days apart, hard stop on any reply
(interested, not-interested, or opt-out all stop the sequence):

1. **Observation + offer.** The one specific, true, verified finding about
   *their* site (from §5 step 3) + the $500/~5-day offer + the guarantee +
   the reply CTA.
2. **Reframe + light proof.** A believable outcome ("clients can book
   without calling"), a one-line answer to the obvious "why so cheap/fast"
   objection, same CTA.
3. **Short breakup.** "I'll stop following up — reply if this becomes
   useful later." Leaves the door open (feeds into `Nurture`) rather than
   burning the lead.

Every email must include:
- A clear statement of who's sending it and the business's real contact
  info (basic CAN-SPAM compliance)
- A plain-language opt-out instruction (e.g. "reply STOP to opt out"),
  wired to the `Opt-out` classification in §5 step 8

Build these as templates with clear personalization placeholders (business
name, the specific verified finding, sender name). The founders may hand-edit
the exact wording later — the system's job is to have a working, compliant,
on-strategy default in place, not to be precious about the literal copy.

---

## 8. What "done" looks like

Running the daily job produces, end to end, with no manual intervention
except the approval gate in §5 step 6:
- New, correctly scored and segmented leads appear in Notion, split
  correctly into `Email` vs `Call List` tracks
- `Email`-track leads get a drafted, personalized email sitting in
  `Ready to Send`, referencing something specific and true about their site
- Approving a draft sends it via Gmail, logs it, and correctly schedules
  the next touch
- A reply gets classified and, if interested, triggers an immediate email
  alert to Kai and Nici with full context
- Opt-outs are permanently suppressed
- None of this requires anything beyond Notion, Gmail, and two API keys —
  no new infrastructure, no visual workflow tool, no app to host

Build config-driven where it reduces future editing (target categories/
geos, send cap, sequence timing, email templates), but don't add
configurability nobody asked for. Simplicity is the standard this whole
system is judged against.

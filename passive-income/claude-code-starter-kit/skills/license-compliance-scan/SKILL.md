---
name: license-compliance-scan
description: Scan a project's dependency tree for open-source license types and flag ones that are incompatible with the project's own license or distribution model (e.g. copyleft licenses pulled into a proprietary product). Use when the user asks to "check dependency licenses," "am I allowed to use this package," or before a release/audit.
---

# License Compliance Scan

Flag license risk in the dependency tree before it becomes a legal problem, without giving
legal advice the user should get from an actual lawyer for anything borderline.

## Steps

1. Determine the project's own license and distribution model (open source and under what
   license, closed-source SaaS, or shipped/distributed proprietary binary) — this changes what
   counts as risky. Ask if it isn't obvious from a `LICENSE` file or `package.json` `license`
   field.
2. Enumerate the full dependency tree's licenses:
   - Node: `npx license-checker --json` (or read `node_modules/*/package.json` `license` fields
     if the tool isn't available)
   - Python: `pip-licenses --format=json` if available, else read each package's metadata
   - Other ecosystems: check for an existing SBOM/license-report tool before hand-rolling one
3. Bucket each license into risk tiers relative to the project's own model:
   - **Permissive** (MIT, BSD, Apache-2.0, ISC) — generally safe in any context.
   - **Weak copyleft** (LGPL, MPL) — usually fine if used as an unmodified library dependency,
     riskier if statically linked/bundled — flag for review rather than asserting safety.
   - **Strong copyleft** (GPL, AGPL) — high risk for a proprietary/closed-source product;
     AGPL specifically also affects SaaS/network use, not just distribution.
   - **No license / unlicensed** — treat as highest risk; legally ambiguous to use at all.
4. For anything in the weak/strong copyleft or unlicensed buckets, name the specific package,
   version, and where it's pulled in (direct vs. transitive dependency) — transitive copyleft
   deps are the ones teams miss.
5. Present a summary table (package, license, risk tier, direct/transitive) and flag which
   entries need an actual legal review — do not tell the user "this is fine" or "this is a
   violation" as a legal conclusion; state the license facts and risk tier, and recommend legal
   review for anything above permissive when the project is closed-source.

## Notes

- This produces a risk report, not legal advice — always say so explicitly for anything in the
  copyleft or unlicensed tiers.
- License fields in package metadata are sometimes wrong or missing; note when a package's
  declared license couldn't be verified against its actual repository.

# Sponsorship & Open-Source Conversion Strategy

Wave A research — sponsorship and OSS conversion for `kartikkabadi/chatgpt-yolo`.
Scope: verify the existing funding destination, then propose launch-ready sponsorship copy that uses that destination without guilt-based language. No changes to `.github/FUNDING.yml`, the Whop product, prices, or page configuration.

## Findings

- `.github/FUNDING.yml` defines a single active funding entry: `custom: "https://whop.com/vex-app/support-for-oss/"`. All other platforms (`github`, `patreon`, `open_collective`, `ko_fi`, etc.) are left as commented templates, so GitHub will render exactly one custom Sponsor link pointing at the Whop page.
- The Sponsor destination is a Whop product titled **"Support for OSS"**, sold by the store **"Kartik"** (store slug `vex-app`).
- The product headline is on-message for OSS: **"Support my OSS projects, money goes to tokens and compute."**
- The current README has no sponsorship presentation yet: no Sponsor link in an action row and no support section. `SUPPORT.md` exists but does not mention funding. This work only proposes copy; it does not edit the README (owned by the README/integration workstream).

## Sponsor page status

Verified via `curl` (HTTP status) and a live browser render on 2026-07-17.

- **Public accessibility:** Confirmed. `GET https://whop.com/vex-app/support-for-oss/` returns **HTTP 200** with no redirect to a login wall; the product page renders fully to an anonymous visitor. (Completing a donation goes through Whop's standard checkout, which may require a Whop account — viewing and choosing an amount does not.)
- **Contribution amounts:** Confirmed. The product exposes three one-time options behind "+2 options" → "Choose your plan":
  - **$5.00 one-time**
  - **$10.00 one-time**
  - **$20.00 one-time**
  This confirms the brief's assumption that the page clearly offers **$5 and $10** (with an additional $20 tier). All are one-time purchases, not subscriptions.
- **Pricing presentation quirk:** The headline price is shown as `$6.25` struck through → **`$5`** with a **"Save 20%"** badge. This promotional-discount framing is auto-applied by Whop; it reads slightly oddly for a donation but does not misrepresent the amount charged.
- **Primary CTA:** "Donate now" — appropriate, non-aggressive wording.
- **Branding on the product page itself:** Clean. The hero reads "Support for OSS" and the seller is "Kartik". There is no confusing product copy on the OSS product panel itself.

## Decisions made

- **Keep the existing Whop destination.** Do not replace, add, or reconfigure funding platforms (per brief §4). The single `custom` link is correct.
- **Reference $5 or $10 in README copy**, since both are confirmed live one-time options. Do not mention the $20 tier in copy (keeps the ask small and non-pushy); do not describe donations as tax-deductible or as unlocking benefits (none are offered).
- **Do not attempt to "fix" the Whop page** (Vex-related recommended products, the "Save 20%" badge, the `vex-app` slug). These are external and out of scope; they are logged as risks with a recommended manual follow-up for Kartik.
- **Action-row ordering:** Install → Watch demo → Sponsor development, with Sponsor as a compact, non-dominant link (per brief §4).
- **No in-extension donation prompts, popups, or banners** — copy lives only in the README and launch post.

## Proposed copy

All links below use the existing Sponsor destination `https://whop.com/vex-app/support-for-oss/`. Handoff note: the README/integration agent should prefer linking the repo's GitHub **Sponsor button** (rendered from `FUNDING.yml`) where natural, and the raw Whop URL where a direct link is clearer. Both resolve to the same page.

### A. Near-top action row (compact, not the dominant CTA)

Plain-text row to sit just under the hero, after Install and Watch demo:

```markdown
[Install](#install) · [Watch demo](#demo) · [Sponsor development](https://whop.com/vex-app/support-for-oss/)
```

If badge-style pills are used elsewhere, an accessible text-label badge is acceptable (avoid image-only buttons):

```markdown
[![Sponsor development](https://img.shields.io/badge/Sponsor-development-ff69b4)](https://whop.com/vex-app/support-for-oss/)
```

Keep Install and Watch demo visually primary; Sponsor is third and lighter weight.

### B. "Support development" section (near Contributing / toward the end)

```markdown
## Support development

YOLO is free and open source. Maintaining a browser extension against a
changing third-party interface takes ongoing testing, compatibility fixes, and
development tooling. If it saves you time, a one-time **$5 or $10** contribution
via the [Sponsor button](https://whop.com/vex-app/support-for-oss/) helps keep
the project maintained.

Other ways to help, all appreciated equally:

- ⭐ Star the repository so more people find it.
- 🐛 Report reproducible bugs with clear steps.
- 🔧 Contribute fixes — see [CONTRIBUTING](CONTRIBUTING.md).
- 📣 Share YOLO with people who babysit long ChatGPT tasks.

Sponsorship is entirely optional and is never required to install or use YOLO.
```

Notes on why this wording:
- No guilt-based or obligation framing ("please", "if you don't", "keep the lights on"). The ask is conditional ("If it saves you time") and explicitly optional.
- No promised perks (the page offers none) and no tax-deductibility claim.
- States the amounts confirmed live ($5 / $10) so the copy matches what the donor actually sees.

### C. Optional one-line variant for the top action row's tooltip / caption

> Free and open source — sponsor $5 or $10 if it saves you time.

## Proposed launch-post sponsorship follow-up

Sponsorship must not lead the main launch post. Use it as a later reply, secondary to install and product value:

> If YOLO saves you time, there's also a Sponsor button on the repo — a one-time $5 or $10 genuinely helps fund ongoing maintenance. Totally optional; the extension is free and open source either way.

Shorter variant (for a threaded reply / character-tight platforms):

> Bonus: there's a Sponsor button on the repo. $5 or $10 helps fund maintenance — optional, YOLO stays free and open source.

## Validation performed

- `curl -sIL` / full `GET` of the funding URL → **HTTP 200**, no login redirect, ~2 MB HTML payload rendered. (Public accessibility confirmed.)
- Parsed the page's embedded checkout data: distinct purchasable prices for the "Support For OSS" product are **$5, $10, $20** (one-time). Cross-checked against the live "Choose your plan" modal in-browser — matches exactly.
- Live browser render captured (see evidence): product hero "Support for OSS", "Donate now" CTA, headline "Support my OSS projects, money goes to tokens and compute", and the three-option plan chooser ($5 / $10 / $20).
- Confirmed `FUNDING.yml` has exactly one active platform (`custom`) so GitHub shows a single Sponsor link.

## Risks

1. **Unrelated Vex products in the "More from Kartik" carousel.** Below the OSS product, the page recommends the seller's other products — **Vex Starter ($9), Vex Builder ($29), AI Agent Setup Audit ($30), Vex Pro ($79), Vex Scale ($199)** ("extraction credits" SaaS tiers). These are clearly labeled "More from Kartik" and are not part of the OSS product, but a first-time sponsor could be mildly distracted or confused about who/what they're supporting. This does not block launch but is worth Kartik's awareness.
2. **Store slug `vex-app` in the URL.** The Sponsor link contains `vex-app`, which is off-brand relative to "YOLO" and "Support for OSS". Sponsors who read the URL may wonder about the connection. Cosmetic; changing it is external to this repo.
3. **"Save 20% / ~~$6.25~~ $5" discount framing on a donation.** Auto-applied by Whop and slightly unusual for a contribution, though not misleading. Optional for Kartik to disable in Whop settings.
4. **Checkout may require a Whop account.** Viewing/selecting is anonymous, but completing payment likely routes through Whop sign-in/checkout, adding a small amount of friction versus a one-click GitHub Sponsors flow. Acceptable given the brief mandates keeping this destination.
5. **Copy/live-page drift.** Amounts and page state were verified on 2026-07-17. If Kartik later changes the Whop tiers, the "$5 or $10" wording in the README and launch post must be updated to match.

## Recommended next action

1. Hand this copy to the README information-architecture / integration agent to place: the compact Sponsor link in the top action row (Install → Watch demo → Sponsor development) and the "Support development" section near Contributing. Do not introduce a second funding platform.
2. Hand the launch-post follow-up to the launch-copy agent for inclusion as a **later reply**, not the main post.
3. Surface Risks #1–#3 to Kartik as optional, external Whop-side cleanups (curate/hide unrelated recommended products, consider a cleaner store slug, optionally disable the "Save 20%" badge) — none block launch.
4. No changes required to `.github/FUNDING.yml`; leave it as-is.

# Data breach response runbook

Internal reference, not a public-facing document. Written so there's already a plan on the day something goes wrong, instead of figuring it out under pressure. Not legal advice - a lawyer should still review this, but a rough plan beats no plan while that conversation is being scheduled.

## What counts as a breach

Any of these, whether caused by an attacker, a bug, or genuine human error:
- Unauthorized access to business or customer data (names, contact details, booking history, payment references).
- Data sent to the wrong recipient (an email to the wrong address, a booking shown to the wrong staff account).
- Loss of access to data you're responsible for (e.g. a compromised admin account used to export or delete records).
- A vendor Vanova relies on (Supabase, Resend, Paystack, Flutterwave, OpenAI) reporting a breach that plausibly touched Vanova's data.

A close call that didn't actually expose anything (a bug caught before real data was touched) isn't a breach, but is still worth a line in the incident log below - patterns matter.

## Immediate steps (first hour)

1. **Contain it.** Rotate any exposed credentials or API keys immediately (Supabase service role key, Resend/OpenAI/Paystack keys, admin passwords if account compromise is suspected). If a specific account or endpoint is the vector, disable or patch it before anything else.
2. **Don't destroy evidence.** Don't delete logs or affected rows yet, even if the instinct is to clean up fast - you need them to actually understand scope before you can honestly tell anyone what happened.
3. **Write down what you know right now**, timestamped: what happened, when you noticed, what data is plausibly affected, how many people. This starts the incident log (template below) and becomes the basis of the NDPC notification if one's needed.

## Assessing scope (first day)

- What data was actually exposed - not just what was theoretically accessible? Check real logs, not assumptions.
- How many people are affected - a handful of test accounts is a very different situation from a real customer list.
- Is this ongoing (still exploitable right now) or already contained?
- Does it involve payment data specifically? Paystack/Flutterwave hold the actual card details, not Vanova directly (see the Privacy Policy's processor disclosures) - but payment *references* and amounts living in Vanova's own database still matter.

## Notification obligations (NDPA 2023)

- **NDPC**: notify within **72 hours of becoming aware** of the breach, for anything that's genuinely a breach (not every close call). When in doubt, notifying and being told it wasn't necessary is the safer side of that line than staying quiet past 72 hours.
- **Affected individuals**: required "without undue delay" specifically for **high-risk** breaches - something that could lead to real harm (identity theft, financial loss, safety risk), not a low-risk technical incident. This is a judgment call the lawyer conversation should sharpen; when genuinely unsure, lean toward telling people.
- Keep the two decisions separate: NDPC notification and individual notification have different thresholds and don't have to happen at the same time or to the same degree.

## Who does what (solo-founder stage)

Right now this is one person's job end to end: contain, assess, notify, fix, follow up. As Vanova adds staff with real access to customer data, this section needs actual names and a clear owner - a plan with nobody's name on it isn't a plan, it's a hope. Revisit this file whenever the team changes size.

## After it's handled

- Root-cause it properly, the same way a real bug gets root-caused, not just patched at the surface.
- Note what would have caught it sooner (better logging, an alert, a code review catch) and actually make that change - a breach that teaches nothing about the next one is a wasted lesson.
- If individuals were notified, a short follow-up once it's fully resolved is worth sending - closes the loop rather than leaving people wondering.

## Incident log template

Copy this block per incident, keep every entry even for near-misses:

```
Date noticed:
Date occurred (if different/unknown, say so):
What happened:
Data plausibly affected:
Number of people affected:
Containment steps taken:
NDPC notified? (Y/N, date):
Individuals notified? (Y/N, date, and why/why not):
Root cause:
Fix applied:
What would have caught this sooner:
```

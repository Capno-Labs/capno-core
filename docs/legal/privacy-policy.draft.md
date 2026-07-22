# CAPNO Studio — Privacy Policy

> **DRAFT — FOR ATTORNEY REVIEW. NOT IN EFFECT. NOT LEGAL ADVICE.**
> This document was prepared internally as a starting point for legal
> counsel. It has not been reviewed by a lawyer and must not be published,
> linked from the application, or presented to users until counsel has
> revised and approved it. Bracketed items marked `[PLACEHOLDER — for
> counsel]` are unresolved decisions. Companion document:
> [Terms of Service draft](./terms-of-service.draft.md).

**Effective date:** `[PLACEHOLDER — for counsel: effective date]`

This Privacy Policy describes how **Capno Labs LLC** ("**Capno Labs**,"
"**we**," "**us**") handles information in connection with the hosted
CAPNO Studio service at capno.app (the "**Service**").

**Scope.** This policy covers only the hosted Service operated by Capno
Labs. CAPNO Studio is also open-source software that anyone can self-host;
data in a self-hosted deployment is processed by whoever operates that
deployment and **never reaches Capno Labs**. This policy does not apply to
self-hosted deployments.

An important design fact about CAPNO Studio: it is **local-first**. Most
data lives in your own browser and is only sent to Capno Labs when you
sign in and use cloud features. There are no ads and no analytics or
tracking in the application.

---

## 1. Information we collect

We collect only what is needed to operate the Service:

**Account information.** Email address, password credentials (handled by
our authentication provider; we never see your plaintext password), and
your role (student, faculty, or admin) within your institution.

**Faculty cloud content.** When a signed-in faculty account uses cloud
sync, we store:

- custom simulation scenarios and scenario versions authored by faculty;
- session records and debrief reports from completed simulation
  sessions. A debrief may include **optional learner names** if a
  faculty member chose to type them in — this is free text entered at
  the faculty member's discretion, and the Service does not require it.

**Simulated patients only.** All "patients" in CAPNO Studio are
fictional. The Service is designed to hold no real patient data or
protected health information, and the Terms of Service prohibit
submitting any.

**Support communications.** If you contact us, we receive what you send
(e.g., your email and message).

**Server logs.** Our infrastructure providers generate standard technical
logs (such as IP address, timestamps, and request metadata) needed to
operate and secure the Service. `[PLACEHOLDER — for counsel: confirm
log retention practice with the hosting provider and state it.]`

## 2. Information that stays on your device

The application stores working data in your browser's local storage and
does not transmit it to Capno Labs. This includes:

- session archives and debrief history kept locally;
- locally authored scenarios and scenario collections;
- interface preferences (e.g., monitor sound, demo state);
- a queue of pending cloud sync items, if you use cloud sync;
- if you configure a bring-your-own-key AI provider: **your AI provider
  API key is stored only in your browser's local storage and is sent
  only to that provider — never to Capno Labs.**

Clearing your browser storage deletes this on-device data. Capno Labs
cannot access, recover, or delete it for you.

## 3. No analytics, tracking, or advertising

The application contains no third-party analytics, advertising, tracking
pixels, or social-media embeds. We do not sell personal information, and
we do not share it for cross-context behavioral advertising.
`[PLACEHOLDER — for counsel: if the capno.app marketing site (as opposed
to the application) ever adds analytics, this policy or a separate site
policy must cover it.]`

## 4. Cookies and local storage

The Service uses browser local storage (not third-party cookies) for the
on-device data described in Section 2 and for keeping you signed in
(an authentication session token from our authentication provider).
These are strictly functional. `[PLACEHOLDER — for counsel: whether an
EU-style cookie/storage notice is required given functional-only use.]`

## 5. AI features and what they send

AI features are optional and off by default. When they are not
configured, the application makes no AI-related network calls.

When a faculty user actively uses an AI feature, the prompt they type and
relevant scenario data (and any material they choose to paste, such as
syllabus text) are sent to a large language model provider in one of two
configurations:

1. **Bring-your-own-key:** your browser sends the request directly to
   the provider you configured (currently OpenRouter), under your own
   account and that provider's terms and privacy policy. Capno Labs is
   not part of this data flow.
2. **Managed gateway:** the request is routed through a gateway operated
   by Capno Labs (authenticated with your account session) to a model
   provider selected by Capno Labs. `[PLACEHOLDER — for counsel: name
   the provider(s) behind the managed gateway, their data-retention /
   no-training commitments, and whether gateway requests are logged.]`

AI output is authoring assistance for simulation content only and is
reviewed by faculty before use with learners.

## 6. How we use information

We use the information in Section 1 to: provide and secure the Service
(authentication, role-based access, storing and syncing your content);
respond to support requests; and comply with legal obligations. We do
not use your content to train AI models. `[PLACEHOLDER — for counsel:
confirm this commitment is acceptable as drafted; it reflects current
practice.]`

## 7. How information is shared

We share information only with:

- **Service providers (processors):** our database, authentication, and
  hosting infrastructure (currently **Supabase**,
  `[PLACEHOLDER — for counsel: hosting region(s)]`), and — for the
  managed AI gateway only — the model provider(s) described in
  Section 5.
- **Your institution:** content synced by faculty accounts is visible
  within the institution according to the Service's role-based access
  rules (e.g., institution faculty and administrators).
- **Legal:** if required by law or to protect the Service, users, or the
  public, and in that case only as legally required.
- **Business transfers:** if Capno Labs is involved in a merger,
  acquisition, or asset sale, subject to this policy's commitments.

We do not sell personal information.

## 8. Retention and deletion

Cloud content remains stored while the associated account or institution
relationship is active. On account deletion or termination of the Terms,
we delete cloud content after the export window described in the Terms
(`[PLACEHOLDER — for counsel: align retention/deletion timelines with
ToS §11.4 and provider log retention]`), except where retention is
required by law. On-device data (Section 2) is under your control and is
deleted by clearing browser storage.

Faculty can also delete individual scenarios and session records from
within the Service, which removes them from cloud storage.

## 9. Security

We rely on our infrastructure provider's security controls (encrypted
transport, authenticated APIs) and enforce role-based, row-level access
rules so users can only reach records their role permits. No method of
transmission or storage is perfectly secure; we cannot guarantee absolute
security. `[PLACEHOLDER — for counsel: breach-notification commitments
and applicable state/EU notification obligations.]`

Note: optional classroom conveniences in the application (such as a
faculty PIN or session join codes) are coordination features, not
security controls; account authentication is the security boundary for
stored data.

## 10. Children

The Service is intended for healthcare-education settings and is not
directed to children under `[PLACEHOLDER — for counsel: 13 (COPPA) / 16
(GDPR) — align with ToS eligibility]`. We do not knowingly collect
personal information from children. If you believe a child has provided
personal information, contact us and we will delete it.

## 11. Education records (FERPA) — note for counsel

Debrief records may include optional learner names entered by faculty
and could constitute "education records" of a U.S. institution under
FERPA. `[PLACEHOLDER — for counsel: determine whether Capno Labs should
act as a "school official" under institutional agreements, whether a
student-data privacy addendum/DPA should be standard, and any state
student-privacy law obligations (e.g., SOPIPA analogs). This section
should either become user-facing language or move entirely into the
institutional agreement.]`

## 12. International users and your rights

`[PLACEHOLDER — for counsel: this entire section needs
jurisdiction-specific drafting.]`

- **EU/UK (GDPR/UK GDPR):** legal bases for processing, controller vs.
  processor role (Capno Labs is plausibly a processor for institutional
  learner data and a controller for account data), data-transfer
  mechanism for any EU→US transfers, EU/UK representative if required,
  and data-subject rights procedures.
- **California (CCPA/CPRA) and other U.S. state laws:** applicability
  thresholds, notice-at-collection, and rights requests.
- **Access, correction, deletion:** regardless of jurisdiction, users
  may contact us at the address below to access, correct, or delete
  their account information; institutional content requests may be
  routed through the institution.

## 13. Changes to this policy

We will post any changes to this policy and, for material changes,
notify account holders by `[PLACEHOLDER — for counsel: notice mechanism,
align with ToS §16]` before they take effect.

## 14. Contact

Capno Labs LLC
`[PLACEHOLDER — for counsel: mailing address]`
`[PLACEHOLDER — for counsel: privacy contact email, e.g.,
privacy@capno.app]`

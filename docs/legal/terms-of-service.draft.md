# CAPNO Studio — Terms of Service

> **DRAFT — FOR ATTORNEY REVIEW. NOT IN EFFECT. NOT LEGAL ADVICE.**
> This document was prepared internally as a starting point for legal counsel.
> It has not been reviewed by a lawyer and must not be published, linked from
> the application, or presented to users until counsel has revised and
> approved it. Bracketed items marked `[PLACEHOLDER — for counsel]` are
> unresolved business or jurisdictional decisions. See also the companion
> [Privacy Policy draft](./privacy-policy.draft.md) and the
> [Notes for counsel](#notes-for-counsel) at the end of this document.

**Effective date:** `[PLACEHOLDER — for counsel: effective date]`

These Terms of Service (the "**Terms**") govern access to and use of the
hosted CAPNO Studio service available at capno.app (the "**Service**"),
operated by **Capno Labs LLC** ("**Capno Labs**," "**we**," "**us**").
By creating an account or using the Service, you agree to these Terms. If
you are accepting on behalf of an educational institution or other
organization, you represent that you have authority to bind that
organization, and "**you**" refers to that organization.

These Terms apply **only to the hosted Service**. The CAPNO Studio
open-source software is separately licensed under the Apache License 2.0
and is not governed by these Terms (see Section 9).

---

## 1. Definitions

- "**Service**" — the hosted CAPNO Studio web application and related
  services operated by Capno Labs at capno.app, including account
  management, cloud storage of scenarios and session records, and any
  optional AI features we operate.
- "**Customer**" or "**Institution**" — the school, university, hospital
  education program, simulation center, or other organization that holds
  the relationship with Capno Labs.
- "**Faculty User**" — an individual with a faculty or administrator role
  who operates simulation sessions, authors scenarios, and manages
  records.
- "**Student Viewer**" — an individual who views a mirrored student
  monitor during a session. Student Viewers observe broadcast simulation
  displays; the Service does not accept simulation input from them.
- "**User Content**" — content submitted to or stored in the Service by or
  for a Customer, including custom scenarios, scenario collections,
  session records and debrief reports, and any free-text entries made by
  Faculty Users (such as optional learner names on a debrief).
- "**AI Features**" — optional features that use third-party large
  language models to assist with scenario drafting and session operation
  (see Section 7).

## 2. The Service

CAPNO Studio is an anesthesia **simulation** platform for education. A
Faculty User drives a simulated patient monitor in real time; Student
Viewers watch a mirrored monitor; sessions end in a scored debrief report.
The hosted Service adds accounts, roles, and cloud storage that
synchronizes Faculty Users' custom scenarios and session records within
their Institution.

The software also runs locally in the browser and can operate offline;
data handled purely on-device is described in the Privacy Policy and is
not transmitted to Capno Labs.

## 3. Medical and Simulation Disclaimer

**READ THIS SECTION CAREFULLY.**

**THE SERVICE IS FOR SIMULATION AND EDUCATION ONLY — NOT FOR CLINICAL
USE. THE SERVICE IS NOT A MEDICAL DEVICE. NEVER USE THE SERVICE FOR
CLINICAL CARE, DIAGNOSIS, TREATMENT, PATIENT MONITORING, OR ANY OTHER
CLINICAL PURPOSE.**

Without limiting the foregoing:

1. The Service simulates physiology and monitoring displays for training
   purposes. Displayed vital signs, waveforms, alarms, and physiological
   responses are simulated and are not derived from, and must not be
   connected to or relied upon for, any real patient.
2. Scenario content — including drug names, doses, treatment sequences,
   and physiological values, whether bundled, faculty-authored, or
   AI-assisted — is teaching material. It is not medical advice and is
   not warranted to be accurate, complete, or current for patient care.
3. Debrief reports are educational records of a simulation session. As
   stated on each report: they are "simulation only — not a clinical
   record."
4. The Service is not intended to satisfy, and Capno Labs does not
   represent that it satisfies, any regulatory requirement applicable to
   medical devices or clinical software in any jurisdiction.

You agree not to use, deploy, or permit the use of the Service in any
clinical setting or for any clinical purpose.

## 4. Eligibility and Accounts

1. **Intended users.** The Service is intended for use by educational
   institutions and their faculty, staff, and enrolled learners in
   healthcare education. `[PLACEHOLDER — for counsel: is the offering
   B2B/institution-only, or are individual faculty accounts permitted?]`
2. **Age.** The Service is not directed to children. Users must be at
   least `[PLACEHOLDER — for counsel: 13/16/18, per minors policy]` years
   old.
3. **Account security.** Faculty Users sign in with an email address and
   password. You are responsible for safeguarding credentials and for
   activity under your accounts, and you will notify us promptly of any
   suspected unauthorized use.
4. **Roles.** New accounts default to a student role; faculty and
   administrator roles are granted by an Institution administrator.
   Access to records is controlled by these roles.
5. **Classroom access controls.** Optional in-app conveniences such as a
   faculty PIN or session join codes are classroom-coordination features,
   not security measures, and we make no representation that they prevent
   unauthorized access. Account authentication (this Section 4) is the
   access-control mechanism for stored data.

## 5. Acceptable Use

You will not, and will not permit others to:

1. use the Service for clinical care or any purpose prohibited by
   Section 3;
2. use the Service in violation of applicable law, or upload User Content
   that is unlawful, infringing, or that you lack rights to submit;
3. submit real patient data or protected health information to the
   Service (see Section 6.4);
4. probe, scan, or test the vulnerability of the Service, circumvent
   access controls, or access accounts or data of others without
   authorization;
5. interfere with or disrupt the integrity or performance of the Service,
   or impose an unreasonable load on it;
6. resell, sublicense, or provide the hosted Service to third parties as
   a commercial offering, except as expressly agreed with Capno Labs in
   writing. (This restriction applies to the hosted Service only; your
   rights to the open-source software under Apache-2.0, including the
   right to self-host and offer it to others, are unaffected — see
   Section 9.)

## 6. User Content

1. **Ownership.** As between you and Capno Labs, you retain all rights in
   your User Content. Capno Labs does not claim ownership of your
   scenarios, session records, or debriefs.
2. **License to operate.** You grant Capno Labs a limited, non-exclusive,
   worldwide license to host, store, transmit, display, and process User
   Content solely as necessary to provide and secure the Service and as
   permitted by the Privacy Policy.
3. **Responsibility.** You are responsible for User Content your users
   submit, including any personal information Faculty Users choose to
   enter (for example, optional learner names on debrief reports), and
   for having any permissions required to record it. `[PLACEHOLDER — for
   counsel: FERPA posture where debrief records constitute education
   records of a US institution; whether a DPA / student-data addendum is
   needed for institutional customers.]`
4. **No PHI.** The Service is designed for simulated patients only. You
   must not submit protected health information or other real patient
   data. Capno Labs is not a "business associate" under HIPAA and no
   business associate agreement is offered.
5. **Export and deletion.** The Service provides means to export your
   session records and scenarios (including printable debrief reports and
   scenario files). Upon termination, we will delete or return User
   Content as described in Section 11 and the Privacy Policy.

## 7. AI Features

1. **Optional.** AI Features are optional and off by default. When not
   configured, the Service renders no AI functionality and sends no data
   to model providers.
2. **Third-party models.** AI Features use third-party large language
   model providers. Depending on configuration, either (a) your browser
   sends requests directly to a provider (such as OpenRouter) using an
   API key you supply and store locally — such use is governed by that
   provider's terms, and your key is not transmitted to Capno Labs — or
   (b) requests are routed through a gateway operated by Capno Labs using
   your authenticated session. The Privacy Policy describes what is sent
   in each case.
3. **Faculty review required.** AI output is simulation-authoring
   assistance only — not clinical guidance. All AI-generated content must
   be reviewed by a qualified Faculty User before use with learners.
   AI-drafted scenarios are tagged as AI-generated until reviewed.
4. **No warranty of output.** AI output may be inaccurate or incomplete.
   Capno Labs does not warrant the accuracy, completeness, or clinical
   validity of AI output, and Section 3 applies fully to it.

## 8. Fees

`[PLACEHOLDER — for counsel and business: pricing model (free beta /
per-institution subscription / per-seat), billing terms, taxes, refunds,
trial terms, and effect of nonpayment. The Service may currently be
offered without charge; if so, state that fees may be introduced with
notice and will never apply retroactively.]`

## 9. Relationship to the Open-Source Software

1. The CAPNO Studio core software is available at
   github.com/Capno-Labs/capno-core under the **Apache License 2.0**.
   Nothing in these Terms limits, conditions, or modifies any rights
   granted under that license, including the right to use, modify, and
   self-host the software.
2. These Terms govern only the hosted Service operated by Capno Labs.
   Self-hosted deployments are not the Service, are not operated or
   supported by Capno Labs under these Terms, and are the sole
   responsibility of the deploying party.
3. **Trademarks.** CAPNO, CAPNO Studio, and the Capno Labs name, logos,
   and brand assets are trademarks of Capno Labs LLC. Consistent with
   Section 6 of the Apache License 2.0, no trademark rights are granted
   by these Terms or by the open-source license.

## 10. Third-Party Services

The Service is built on third-party infrastructure and services,
including database and authentication infrastructure (currently
Supabase) and, for AI Features, third-party model providers. Capno Labs
is responsible for the Service as a whole, but third-party services you
elect to use directly under your own accounts or keys (such as a
bring-your-own-key model provider) are governed by those providers'
terms.

## 11. Term, Suspension, and Termination

1. **Term.** These Terms apply from your first use of the Service until
   terminated.
2. **Termination by you.** You may stop using the Service and request
   account deletion at any time.
3. **Suspension and termination by us.** We may suspend or terminate
   access for material breach of these Terms (including Section 3 or
   Section 5), for security reasons, or where required by law. Where
   practicable, we will give notice and an opportunity to cure before
   termination for breach.
4. **Effect of termination.** Upon termination, your right to use the
   Service ends. For a period of `[PLACEHOLDER — for counsel: e.g., 30
   days]` after termination, we will make User Content available for
   export, after which we will delete it as described in the Privacy
   Policy, except as retention is required by law. Sections 3, 6.1, 9,
   12–15, and 17 survive termination.

## 12. Intellectual Property; Feedback

The Service, including its software, design, and content (excluding User
Content and the separately licensed open-source software), is owned by
Capno Labs and its licensors. If you provide suggestions or feedback
about the Service, you grant Capno Labs a perpetual, irrevocable,
royalty-free license to use it without restriction or obligation.

## 13. Warranty Disclaimer

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT
PERMITTED BY LAW, CAPNO LABS DISCLAIMS ALL WARRANTIES, EXPRESS OR
IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
NON-INFRINGEMENT, ACCURACY, AND UNINTERRUPTED OR ERROR-FREE OPERATION.
WITHOUT LIMITING SECTION 3, CAPNO LABS MAKES NO WARRANTY THAT SIMULATION
CONTENT, PHYSIOLOGY MODELS, OR AI OUTPUT ARE CLINICALLY ACCURATE OR
SUITABLE FOR ANY PURPOSE OTHER THAN EDUCATION.
`[PLACEHOLDER — for counsel: jurisdictions that limit warranty
disclaimers; consumer-protection carve-outs if individuals may be
customers.]`

## 14. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) CAPNO LABS WILL NOT BE LIABLE
FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL; AND (B) CAPNO LABS'
AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE SERVICE WILL NOT
EXCEED THE GREATER OF THE AMOUNTS YOU PAID FOR THE SERVICE IN THE TWELVE
MONTHS BEFORE THE CLAIM AND `[PLACEHOLDER — for counsel: floor amount,
e.g., US $100]`. THESE LIMITS DO NOT APPLY TO LIABILITY THAT CANNOT BE
LIMITED BY LAW. `[PLACEHOLDER — for counsel: carve-outs (willful
misconduct, breach of confidentiality, indemnity) and whether any
liability cap should differ for paying institutions.]`

USE OF THE SERVICE IN VIOLATION OF SECTION 3 (CLINICAL USE) IS OUTSIDE
THE SCOPE OF THE SERVICE, AND CAPNO LABS DISCLAIMS ALL LIABILITY ARISING
FROM SUCH USE TO THE MAXIMUM EXTENT PERMITTED BY LAW.

## 15. Indemnification

You will defend and indemnify Capno Labs against third-party claims
arising from (a) your User Content, (b) your use of the Service in
violation of these Terms, including any clinical use prohibited by
Section 3, or (c) your violation of law, except to the extent the claim
arises from Capno Labs' own breach of these Terms.
`[PLACEHOLDER — for counsel: mutuality; whether institutional customers
will accept one-way indemnity; public-institution constraints on
indemnification.]`

## 16. Changes to the Service and to These Terms

We may modify the Service, provided that we will not materially degrade
core functionality of the hosted Service during a paid term without
notice. We may update these Terms; material changes will be notified in
advance by `[PLACEHOLDER — for counsel: notice mechanism, e.g., email
and in-app notice]` and apply prospectively. Continued use after the
effective date of changes constitutes acceptance.

## 17. Governing Law and Disputes

These Terms are governed by the laws of `[PLACEHOLDER — for counsel:
governing law]`, without regard to conflict-of-laws rules. Disputes will
be resolved in `[PLACEHOLDER — for counsel: venue / courts vs.
arbitration; class-action waiver decision; carve-out for injunctive
relief]`.

## 18. General

Assignment: you may not assign these Terms without our consent, except
to a successor of your institution's program; we may assign to an
affiliate or successor. Severability: if a provision is unenforceable,
the remainder stays in effect. No waiver is implied from any failure to
enforce. These Terms, together with the Privacy Policy and any signed
institutional agreement (which controls over these Terms if in
conflict), are the entire agreement regarding the Service. Notices to
Capno Labs: `[PLACEHOLDER — for counsel: legal notice address and
email]`. Notices to you: your account email.

---

## Notes for counsel

Open questions and decisions needed before this draft can be finalized
(none of these are answered in the codebase or by existing business
decisions):

1. **Offering shape** — institution-only (B2B) vs. individual faculty
   sign-ups; affects eligibility, consumer-law exposure, indemnity, and
   the liability cap.
2. **Governing law, venue, arbitration** — including whether to adopt
   arbitration + class-action waiver, and public-institution objections
   to venue/indemnity/arbitration clauses.
3. **Student data** — debrief records can include optional
   faculty-entered learner names. Assess FERPA (education records,
   "school official" exception), state student-privacy laws (e.g., SOPIPA
   and analogs), and whether a DPA / student-data privacy addendum should
   be standard for institutional customers.
4. **International users** — GDPR/UK GDPR readiness if EU/UK institutions
   sign up (see companion Privacy Policy draft), data-transfer mechanism,
   and whether to geographically limit the offering initially.
5. **Minors** — minimum age and whether any learner-facing surface could
   be used by minors (e.g., pre-nursing/high-school health programs);
   COPPA posture.
6. **Fees and SLA** — whether launch is a free beta; if so, add beta
   terms (no SLA, may change). If paid, add billing terms and decide on
   any uptime commitment.
7. **Medical-device positioning** — Section 3 is drafted to make
   clear the product is education-only and to keep it outside FDA
   SaMD / EU MDR scope. Please review whether the disclaimer and
   acceptable-use prohibition are sufficient, and whether marketing
   claims need corresponding review.
8. **Regulatory/consumer review of disclaimers** — Sections 13–14 need
   jurisdiction-specific tailoring (e.g., Australia/UK/EU consumer law if
   ever offered there).
9. **Insurance alignment** — confirm liability cap and indemnity align
   with Capno Labs' E&O/cyber coverage.

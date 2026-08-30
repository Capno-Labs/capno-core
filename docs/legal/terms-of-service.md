# CAPNO Studio — Terms of Service

> **Reviewed and approved by counsel as-is on August 24, 2026, and
> effective the same day.** These Terms govern the **hosted** CAPNO Studio
> service operated by Capno Labs LLC. They do not govern this open-source
> repository, which is licensed solely under Apache-2.0 — see `LICENSE`
> and `NOTICE`, and Section 9 below.
>
> The canonical public rendering is at capno.app/legal/terms; this file is
> the source-of-record copy. Keep the two in sync: any change must land on
> both, requires counsel review, and must bump the hosted service's
> `TERMS_VERSION` clickwrap constant so acceptances are logged against the
> new version. Companion document:
> [Privacy Policy draft](./privacy-policy.draft.md).

**Effective date:** August 24, 2026
**Last updated:** August 24, 2026

These Terms of Service (the "**Terms**") govern access to and use of the
hosted CAPNO Studio service, operated by **Capno Labs LLC**
("**Capno Labs**," "**we**," "**us**"). The Service is provided through
**studio.capno.app** (the simulator) and **start.capno.app** (account
onboarding, organization management, and billing). By creating an account
or using the Service, you agree to these Terms. If you are accepting on
behalf of an educational institution or other organization, you represent
that you have authority to bind that organization, and "**you**" refers to
that organization.

These Terms apply **only to the hosted Service**. The CAPNO Studio
open-source software is separately licensed under the Apache License 2.0
and is not governed by these Terms (see Section 9).

---

## 1. Definitions

- "**Service**" — the hosted CAPNO Studio web application and related
  services operated by Capno Labs, including the simulator at
  studio.capno.app, account and organization management and billing at
  start.capno.app, cloud storage of scenarios and session records, and any
  optional AI features we operate.
- "**Customer**" or "**Institution**" — the school, university, hospital
  education program, simulation center, or other organization that holds
  the relationship with Capno Labs, represented in the Service as an
  organization.
- "**Faculty User**" — an individual member of a Customer's organization
  with an owner or faculty role who operates simulation sessions, authors
  scenarios, and manages records. The Faculty User who creates an
  organization becomes its owner; owners may invite additional Faculty
  Users.
- "**Student Viewer**" — an individual who views a mirrored student
  monitor during a session. Student Viewers join with a short session code,
  do not need accounts, and observe broadcast simulation displays; the
  Service does not accept simulation input from them.
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
The hosted Service adds accounts, organizations and roles, and cloud
storage that synchronizes Faculty Users' custom scenarios and session
records within their Institution, with optional program analytics and
managed AI Features depending on the Customer's plan (Section 8).

The software also runs locally in the browser and can operate offline;
data handled purely on-device is described in the Privacy Policy and is
not transmitted to Capno Labs.

Some capabilities may be offered as pilot, beta, or pre-release features
(for example, features rolling out with pilot programs). Such features
are provided as-is, may change or be withdrawn, and are excluded from
any availability or continuity commitments in these Terms, including
Section 16's commitment regarding core functionality.

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
   healthcare education. Any Faculty User may create an organization for
   their institution or program on the free trial plan; accepting these
   Terms when creating or joining an organization binds the organization
   as described above.
2. **Age.** The Service is not directed to children. Faculty Users must
   be at least 18 years old.
3. **Account security.** Faculty Users sign in with an email address and
   password. You are responsible for safeguarding credentials and for
   activity under your accounts, and you will notify us promptly of any
   suspected unauthorized use.
4. **Organizations and roles.** An organization is created at
   start.capno.app; the creating Faculty User becomes its owner. Owners
   may invite Faculty Users by email, manage membership, and are the only
   role that can purchase or manage the organization's subscription.
   Access to records is controlled by these roles. Student Viewers do not
   have accounts. You are responsible for use of the Service by your
   Faculty Users and Student Viewers — including Student Viewers, who do
   not themselves accept these Terms — and for their compliance with
   these Terms.
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
4. probe, scan, or test the vulnerability of the Service without our
   prior written authorization, circumvent access controls, or access
   accounts or data of others without authorization — good-faith
   vulnerability reports are welcome at hello@capno.app;
5. interfere with or disrupt the integrity or performance of the Service,
   or impose an unreasonable load on it;
6. resell, sublicense, or provide the hosted Service to third parties as
   a commercial offering, except as expressly agreed with Capno Labs in
   writing. (This restriction applies to the hosted Service only; your
   rights to the open-source software under Apache-2.0, including the
   right to self-host and offer it to others, are unaffected — see
   Section 9.);
7. use the Service in violation of United States export-control or
   economic-sanctions laws. You represent that you are not located in an
   embargoed jurisdiction and are not on any US government
   restricted-party list.

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
   for having any permissions required to record it.
4. **No PHI.** The Service is designed for simulated patients only. You
   must not submit protected health information or other real patient
   data. Capno Labs is not a "business associate" under HIPAA, and no
   business associate agreement is offered unless separately signed in
   writing.
5. **Export and deletion.** The Service provides means to export your
   session records and scenarios (including printable debrief reports and
   scenario files). Upon termination, we will delete or return User
   Content as described in Section 11 and the Privacy Policy.

## 7. AI Features

1. **Optional.** AI Features are optional. When not enabled for your
   organization and not configured by you, the Service renders no AI
   functionality and sends no data to model providers.
2. **Third-party models.** AI Features use third-party large language
   model providers. Depending on configuration, either (a) your browser
   sends requests directly to a provider you choose, using an API key you
   supply and store locally — such use is governed by that provider's
   terms, and your key is not transmitted to Capno Labs — or (b) requests
   are routed through a gateway operated by Capno Labs using your
   authenticated session, under a plan that includes managed AI Features.
   For managed AI Features, we do not authorize AI providers to use your
   User Content or identifiable learner information to train their
   general-purpose models. The Privacy Policy describes what is sent in
   each case.
3. **Faculty review required.** AI output is simulation-authoring
   assistance only — not clinical guidance. All AI-generated content must
   be reviewed by a qualified Faculty User before use with learners.
   AI-drafted scenarios are tagged as AI-generated until reviewed.
4. **No warranty of output.** AI output may be inaccurate or incomplete.
   Capno Labs does not warrant the accuracy, completeness, or clinical
   validity of AI output, and Section 3 applies fully to it.

## 8. Fees, Plans, and Renewal

1. **Plans.** The Service is offered on a free **trial plan** (limited
   features and a limited number of Faculty User seats) and a paid annual
   **site license** per Institution (not per seat), which includes the
   full feature set, such as program analytics and managed AI Features.
   Current plan contents and pricing are presented at purchase. We may
   change what the free trial plan includes with reasonable notice.
2. **Purchases.** Only an organization's owner may purchase or manage its
   site license. Fees are as quoted at the time of purchase. Payments are
   processed by a third-party payment processor (currently Stripe);
   Capno Labs does not receive full payment-card numbers.
3. **Renewal.** The site license runs for a one-year term and renews
   automatically for successive one-year terms at the then-current rate
   unless cancelled before the renewal date. We will send a renewal
   reminder to the organization owner's account email before each renewal
   as required by applicable law.
4. **Cancellation.** The owner may cancel at any time, effective at the
   end of the then-current term; the Service remains available through
   the end of that term, after which the organization returns to the free
   trial plan.
5. **Refunds.** Except where required by law or expressly agreed in
   writing, fees are non-refundable and non-creditable, including for
   partial terms.
6. **Nonpayment.** If a renewal payment fails, we may, after notice and a
   reasonable opportunity to update payment details, downgrade the
   organization to the free trial plan. Downgrading does not delete User
   Content, but features outside the trial plan become unavailable.
7. **Taxes.** Fees are exclusive of taxes; you are responsible for
   applicable sales, use, and similar taxes, excluding taxes on
   Capno Labs' income.
8. **Fee changes.** Fee changes apply prospectively at your next renewal
   and never retroactively; we will give notice before they take effect.

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
Supabase), payment processing (currently Stripe), and, for AI Features,
third-party model providers. Capno Labs is responsible for the Service as
a whole, but third-party services you elect to use directly under your
own accounts or keys (such as a bring-your-own-key model provider) are
governed by those providers' terms.

## 11. Term, Suspension, and Termination

1. **Term.** These Terms apply from your first use of the Service until
   terminated.
2. **Termination by you.** You may stop using the Service and request
   account or organization deletion at any time. Paid-term effects are
   described in Section 8.
3. **Suspension and termination by us.** We may suspend or terminate
   access for material breach of these Terms (including Section 3 or
   Section 5), for security reasons, or where required by law. Where
   practicable, we will give notice and an opportunity to cure before
   termination for breach.
4. **Effect of termination.** Upon termination, your right to use the
   Service ends. For a period of 30 days after termination, we will make
   User Content available for export, after which we will delete it as
   described in the Privacy Policy, except as retention is required by
   law. Sections 3, 6.1, 9, 12–15, 17, and 18 survive termination.

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

## 14. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) CAPNO LABS WILL NOT BE LIABLE
FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL; AND (B) CAPNO LABS'
AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE SERVICE WILL NOT
EXCEED THE GREATER OF THE AMOUNTS YOU PAID FOR THE SERVICE IN THE 12
MONTHS BEFORE THE CLAIM AND US $100. THESE LIMITS DO NOT APPLY TO
LIABILITY THAT CANNOT BE LIMITED BY LAW.

USE OF THE SERVICE IN VIOLATION OF SECTION 3 (CLINICAL USE) IS OUTSIDE
THE SCOPE OF THE SERVICE, AND CAPNO LABS DISCLAIMS ALL LIABILITY ARISING
FROM SUCH USE TO THE MAXIMUM EXTENT PERMITTED BY LAW.

## 15. Indemnification

You will defend and indemnify Capno Labs against third-party claims
arising from (a) your User Content, (b) your use of the Service in
violation of these Terms, including any clinical use prohibited by
Section 3, or (c) your violation of law, except to the extent the claim
arises from Capno Labs' own breach of these Terms.

## 16. Changes to the Service and to These Terms

We may modify the Service, provided that we will not materially degrade
core functionality of the hosted Service during a paid term without
notice. We may update these Terms; material changes will be notified in
advance by email to the organization owner's account email and by notice
in the Service, and apply prospectively. Continued use after the
effective date of changes constitutes acceptance.

## 17. Governing Law and Disputes

These Terms are governed by the laws of the Commonwealth of Virginia,
without regard to conflict-of-laws rules. The state and federal courts
located in Richmond, Virginia have exclusive jurisdiction over disputes
arising out of or relating to these Terms or the Service, and each party
consents to venue there; either party may seek injunctive relief in any
court of competent jurisdiction.

## 18. General

Assignment: you may not assign these Terms without our consent, except
to a successor of your institution's program; we may assign to an
affiliate or successor. Severability: if a provision is unenforceable,
the remainder stays in effect. No waiver is implied from any failure to
enforce. Force majeure: neither party is liable for delay or failure to
perform (other than payment obligations) caused by events beyond its
reasonable control, such as natural disasters, war, terrorism, labor
disputes, internet or utility failures, or acts of government. These
Terms, together with the Privacy Policy and any signed institutional
agreement (which controls over these Terms if in conflict), are the
entire agreement regarding the Service. Notices to Capno Labs:
Capno Labs LLC, 8401 Mayland Dr Ste A, Richmond, VA 23294-4648, United
States, or hello@capno.app. Notices to you: your account email.

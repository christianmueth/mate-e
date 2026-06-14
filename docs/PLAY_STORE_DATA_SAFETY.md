# Play Store Data Safety Answer Sheet

Use this as the first-pass source of truth when filling out Google Play Data safety for the current Mate-E Android wrapper.

This document is intentionally conservative. If the product changes, update this before submitting new Play Console answers.

## Current app architecture

- Android app type: Capacitor wrapper around the hosted Mate-E site
- Hosted service: `https://mate-e.com`
- Authentication provider: Clerk
- File storage provider: Vercel Blob
- AI and transcript processing: server-side providers only
- Native Android permission currently declared: `android.permission.INTERNET` only

## Data categories likely collected

### Personal info

- Email address or account identifier: Yes
Reason: user authentication through Clerk and authenticated app access.

### App activity

- In-app interactions: Yes
Reason: tutoring interactions, workspace actions, reasoning/governance logs, and continuity state are part of the product.

### User-generated content

- Text input: Yes
Reason: prompts, notes, tutoring input, workspace annotations, flashcard/study content.

- Uploaded files and attachments: Yes
Reason: users can upload PDFs, PPTX files, subtitles, audio, and video for processing.

### Diagnostics

- Crash or performance diagnostics: Limited operational diagnostics only
Reason: server-side logs and device/browser diagnostics may be collected for reliability and abuse investigation.

## Data categories not evidenced in the current repo

Mark these as not collected unless the product changes and code is added:

- precise location
- approximate location
- contacts
- calendar
- SMS or MMS
- call logs
- health or fitness
- financial info
- payment info
- photos library collected in the background
- files accessed without user action
- device advertising ID for ads
- messages

## Core Play Console intent answers

### Is data collected?

Yes.

Rationale: authenticated product usage, user-submitted content, uploads, persisted workspace state, and server-side processing are core to the app.

### Is data shared?

Yes, with service providers acting on behalf of the product.

Rationale: the app relies on third-party infrastructure and processors such as Clerk, Vercel Blob, hosting infrastructure, and server-side AI/transcript providers.

Do not describe this as selling data or advertising-based sharing.

### Is data encrypted in transit?

Yes.

Rationale: the Android shell points to the hosted HTTPS site and current Capacitor config uses HTTPS only.

### Can users request deletion?

Yes.

Rationale: the privacy policy exposes a deletion/contact path at `https://mate-e.com/privacy` via `christianmueth@outlook.com`.

## Per-category suggested treatment

### Email address or account identifier

- Collected: Yes
- Shared with service providers: Yes
- Required for app functionality: Yes
- Purpose: account management, authentication, security

### User-generated content

- Collected: Yes
- Shared with service providers: Yes, where needed for storage and AI processing
- Required for app functionality: Yes
- Purpose: app functionality, personalization, support of tutoring/workspace generation

### Uploaded files

- Collected: Yes
- Shared with service providers: Yes
- Required for app functionality: Optional feature, user-initiated
- Purpose: app functionality

### App interactions and diagnostics

- Collected: Yes
- Shared with service providers: potentially, through hosting and operational tooling
- Required for app functionality: partly
- Purpose: analytics, fraud prevention, security, debugging, product improvement

## Permissions and access summary

Current evidence in the repo supports the following claims:

- Internet access is required.
- No Android location permission is declared.
- No Android camera permission is declared.
- No Android microphone permission is declared.
- No Android contacts permission is declared.
- No ad SDK is present in app dependencies.

The app does support user-initiated file upload flows through the web layer.

## Evidence anchors in the repo

- Authentication and privacy policy: `app/privacy/page.tsx`
- Upload handling: `components/CreateForm.tsx`, `app/api/blob-upload/route.ts`, `app/api/flashcards/route.ts`
- Local continuity storage: `components/WorkspaceWhiteboard.tsx`, `lib/workspaceContext.ts`
- Android permissions: `android/app/src/main/AndroidManifest.xml`
- Third-party transcript processing: `lib/supadata.ts`, `lib/asrClient.ts`

## Review-before-submit warnings

1. Re-check this document if camera, microphone, push notifications, geolocation, or native plugins are added.
2. Re-check this document if analytics SDKs or crash reporters are added to the Android shell.
3. Keep Play Console wording aligned with the live privacy policy.
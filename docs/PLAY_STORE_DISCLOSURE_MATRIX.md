# Play Store Disclosure Matrix

Use this as the field-by-field working sheet when filling Play Console for the current Mate-E Android wrapper.

This is not legal advice. It is a repo-grounded answer draft based on the current code and Android shell.

## App basics

### App name

- Recommended answer: Mate-E
- Backup options: Mate-E Study Workspace, Mate-E Whiteboard Tutor

### Category

- Recommended answer: Education

### Tags

- Recommended answer: Study, Education, Whiteboard, Planning, AI Tools

### Privacy policy URL

- Recommended answer: https://mate-e.com/privacy

## Data safety overview

### Does your app collect or share any of the required user data types?

- Recommended answer: Yes
- Why: the app uses authenticated accounts, accepts user content and uploads, persists workspace state, and sends some server-side requests to storage and AI service providers.

### Is all user data encrypted in transit?

- Recommended answer: Yes
- Why: the Android wrapper points to the hosted HTTPS site and the current Capacitor config uses HTTPS.

### Do you provide a way for users to request that their data is deleted?

- Recommended answer: Yes
- Why: the privacy policy gives a deletion/privacy contact path.

## Data type matrix

### Personal info: email address or account identifier

- Collected: Yes
- Shared: Yes, with service providers acting on behalf of the app
- Required for app functionality: Yes
- Purpose selections: Account management, Authentication, Security and fraud prevention

### User-generated content: text input

- Collected: Yes
- Shared: Yes, where needed for storage and server-side AI processing
- Required for app functionality: Yes
- Purpose selections: App functionality, Personalization

### User-generated content: uploaded files or attachments

- Collected: Yes
- Shared: Yes, with storage and processing providers when the user invokes upload workflows
- Required for app functionality: Optional feature
- Purpose selections: App functionality

### App activity: in-app interactions

- Collected: Yes
- Shared: Limited service-provider handling only
- Required for app functionality: Partly
- Purpose selections: Analytics, App functionality, Fraud prevention, Security, Debugging, Product improvement

### Diagnostics: crash or performance information

- Collected: Limited operational diagnostics only
- Shared: Potentially with service providers supporting hosting and operations
- Required for app functionality: No
- Purpose selections: Analytics, Debugging, Fraud prevention, Security

## Data types to mark as not collected unless the product changes

- precise location
- approximate location
- contacts
- calendar
- SMS or MMS
- call logs
- health data
- financial data
- payment information
- photos or videos collected automatically in the background
- audio recorded from the microphone in the background
- advertising ID for ads or marketing attribution

## Permissions and device capabilities

### Internet permission

- Recommended answer: Used
- Why: required for the hosted app shell and authenticated workflows.

### Camera permission

- Recommended answer: Not requested in the current Android shell

### Microphone permission

- Recommended answer: Not requested in the current Android shell

### Location permission

- Recommended answer: Not requested in the current Android shell

### Contacts permission

- Recommended answer: Not requested in the current Android shell

### Push notifications

- Recommended answer: Not currently configured for release claims
- Why: there is no reliable shipped notification path to claim in store disclosures yet.

## Ads and monetization

### Does the app contain ads?

- Recommended answer: No

### Is data sold?

- Recommended answer: No

## Account and access

### Does the app require sign-in for core functionality?

- Recommended answer: Yes for authenticated workspace flows
- Note: if the Console asks about broad public preview access, describe the app as primarily account-based.

### Can users submit files or content?

- Recommended answer: Yes
- Why: the app supports user-initiated upload of PDF, PPTX, subtitle, audio, and video content.

## Review notes to keep consistent

- Do not claim offline-first functionality beyond installed shell behavior.
- Do not claim native camera or microphone features unless those permissions are actually added.
- Do not claim ads, attribution SDKs, or precise analytics tooling that the current repo does not show.
- Keep the Play answers aligned with `app/privacy/page.tsx` and `docs/PLAY_STORE_DATA_SAFETY.md`.
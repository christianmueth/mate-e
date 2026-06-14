# Play Console Submission Worksheet

Use this document while clicking through Google Play Console for the current Mate-E Android wrapper.

This is a practical submission worksheet, not legal advice. Keep it aligned with the live app, the privacy policy, and the current Android shell before submitting.

## 1. Main store listing

### App name

- Recommended answer: Mate-E
- Backup answers if needed: Mate-E Study Workspace, Mate-E Whiteboard Tutor

### Short description

- Recommended answer: AI-guided study workspace with whiteboard, planning, flashcards, and continuity memory.

### Full description

- Recommended answer:

Mate-E is an AI-guided study workspace built for turning raw material into clearer next actions.

Instead of forcing you to jump between separate tools, Mate-E combines tutoring guidance, a visual whiteboard, planning workflows, and study-material generation in one place. You can bring in source material, map ideas visually, extract tasks, and keep moving without losing continuity across sessions.

Use Mate-E to organize ideas on a flexible whiteboard, turn study content into flashcards and guidance, break work into plans and next steps, and keep continuity across tutoring and workspace sessions.

Core features include AI tutoring guidance, workspace planning surfaces, whiteboard interaction, flashcard generation, and continuity memory that helps the app keep track of ongoing work.

Mate-E is best suited for learners and operators who want one workspace for thinking, planning, and studying rather than a collection of disconnected tools.

### App category

- Recommended answer: Education

### Tags

- Recommended answer: Study, Education, Whiteboard, Planning, AI Tools

### Privacy policy URL

- Recommended answer: https://mate-e.com/privacy

## 2. App access

### Does the app require login to access all or most functionality?

- Recommended answer: Yes
- Notes: authenticated workspace flows are core to the app. If the Console asks for review instructions, explain that core product surfaces are account-based.

### Reviewer instructions

- Recommended answer:

This app is primarily account-based. Sign in is required for the main workspace, whiteboard, and study flows. If Play review requires a test login, provide a dedicated review account through the Play Console access instructions.

## 3. Ads

### Does the app contain ads?

- Recommended answer: No

## 4. Content declarations

### Target audience

- Recommended answer: General student and productivity audience, not specifically directed to children.
- Notes: do not target a child-directed category unless the product and policies are intentionally reworked for that.

### News app?

- Recommended answer: No

### Health app?

- Recommended answer: No

### Financial features?

- Recommended answer: No

### Gambling or betting?

- Recommended answer: No

## 5. Data safety

### Does your app collect or share required user data types?

- Recommended answer: Yes

### Is all user data encrypted in transit?

- Recommended answer: Yes

### Do you provide a way for users to request deletion of their data?

- Recommended answer: Yes
- Notes: privacy requests route to `christianmueth@outlook.com` via the privacy policy page.

## 6. Data-type answers

### Personal info: email address or account identifier

- Collected: Yes
- Shared: Yes, with service providers acting on behalf of the app
- Purpose: Account management, Authentication, Security and fraud prevention
- Optional/required: Required for core authenticated flows

### User-generated content: text input

- Collected: Yes
- Shared: Yes, where needed for storage and server-side AI processing
- Purpose: App functionality, Personalization
- Optional/required: Core app functionality

### User-generated content: uploaded files and attachments

- Collected: Yes
- Shared: Yes, when the user invokes upload and processing flows
- Purpose: App functionality
- Optional/required: Optional feature, user-initiated

### App activity: in-app interactions

- Collected: Yes
- Shared: Limited service-provider handling only
- Purpose: Analytics, App functionality, Fraud prevention, Security, Debugging, Product improvement
- Optional/required: Partly required for service operation

### Diagnostics: crash or performance information

- Collected: Limited operational diagnostics only
- Shared: Potentially with service providers supporting hosting and operations
- Purpose: Analytics, Debugging, Fraud prevention, Security
- Optional/required: Not required for end-user functionality

### Data types to mark as not collected unless the app changes

- precise location
- approximate location
- contacts
- calendar
- SMS or MMS
- call logs
- financial info
- payment info
- health data
- advertising ID for ads
- background microphone capture
- background photo or file collection

## 7. Permissions and device capabilities

### Internet permission

- Recommended answer: Used
- Why: required for the hosted Capacitor shell and authenticated web app access.

### Camera permission

- Recommended answer: Not requested

### Microphone permission

- Recommended answer: Not requested

### Location permission

- Recommended answer: Not requested

### Contacts permission

- Recommended answer: Not requested

### Push notifications

- Recommended answer: Do not claim as a current released feature

## 8. Store assets checklist

Prepare these before final submission:

- app icon
- phone screenshots
- feature graphic if required by the chosen listing setup
- short description
- full description
- privacy policy URL
- release notes for the build

Recommended screenshot set:

1. Workspace home and command bar
2. Whiteboard mobile interaction
3. Operations or planning view
4. Flashcard or tutoring flow

## 9. Release notes

### Internal testing release notes

- Recommended answer:

Initial Android wrapper for Mate-E with hosted sign-in, whiteboard workflows, planning surfaces, flashcard generation, and installable app support.

## 10. Final pre-submit checks

Confirm all of the following before clicking submit:

- `npm run build` succeeds
- `npm run android:sync` succeeds
- the `.aab` was generated from the current Android project
- the privacy policy URL is live
- Play listing text matches current app behavior
- Data safety answers match `docs/PLAY_STORE_DATA_SAFETY.md`
- no undeclared permission has been added to `android/app/src/main/AndroidManifest.xml`

## 11. If Play review asks follow-up questions

Use these short clarifications:

- Architecture: Mate-E is a Capacitor-based Android wrapper around the hosted HTTPS Mate-E web application.
- Authentication: core workspace functionality is account-based.
- Data handling: user-submitted content is processed through server-side product infrastructure and service providers acting on behalf of the app.
- Permissions: the current Android shell requests internet access only.
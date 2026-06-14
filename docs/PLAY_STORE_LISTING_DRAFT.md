# Play Store Listing Draft

Use this as the first-pass content set for Google Play internal testing.

## App name

Mate-E

Alternative names to keep in reserve if store review or trademark overlap requires a narrower label:

- Mate-E Study Workspace
- Mate-E Whiteboard Tutor
- Mate-E Learning Workspace

## Short description

AI-guided study workspace with whiteboard, planning, flashcards, and continuity memory.

Additional short-description options under the Play Console character limit:

- Turn study material into plans, whiteboards, and flashcards.
- AI study workspace for planning, whiteboarding, and tutoring.
- Organize ideas, generate study aids, and keep learning context.

## Full description

Mate-E is a study and thinking workspace that helps learners turn messy source material into clearer next actions.

The app combines tutoring guidance, planning tools, whiteboarding, flashcard generation, and workspace continuity so users can keep moving through complex work without losing context.

Core capabilities currently include:

- AI tutoring and guidance
- visual whiteboard workspace
- task extraction and planning support
- flashcard and study-material generation
- continuity memory across sessions
- workspace command bar for faster workflows

Mate-E is designed for students and operators who want a single workspace for exploring ideas, organizing tasks, and moving from concept mapping into execution.

## Paste-ready long description

Mate-E is an AI-guided study workspace built for turning raw material into clearer next actions.

Instead of forcing you to jump between separate tools, Mate-E combines tutoring guidance, a visual whiteboard, planning workflows, and study-material generation in one place. You can bring in source material, map ideas visually, extract tasks, and keep moving without losing continuity across sessions.

Use Mate-E to:

- organize ideas on a flexible whiteboard
- turn study content into flashcards and guidance
- break work into plans and next steps
- keep continuity across tutoring and workspace sessions
- move from rough notes into structured execution

Core features include AI tutoring guidance, workspace planning surfaces, whiteboard interaction, flashcard generation, and continuity memory that helps the app keep track of ongoing work.

Mate-E is best suited for learners and operators who want one workspace for thinking, planning, and studying rather than a collection of disconnected tools.

## Feature highlights for store assets

Use these as screenshot captions, promo text seeds, or section headers:

- Think visually with a touch-friendly workspace whiteboard
- Turn source material into study actions and plans
- Generate flashcards and guided study support
- Keep continuity across ongoing work sessions
- Use one command layer across planning and whiteboarding

## Privacy policy URL

Use the deployed route:

`https://mate-e.com/privacy`

## Suggested Play Console categorization

- App category: Education or Productivity
- Tags: Study, Education, Whiteboard, Planning, AI Tools

Recommended first pass:

- Primary category: Education
- Secondary positioning in copy: Productivity

## Internal testing checklist

Before uploading the first `.aab`, verify all of the following:

1. The web app loads correctly on mobile at `https://mate-e.com`.
2. Sign-in works on device without redirect loops.
3. Whiteboard touch interactions are usable on phone and tablet.
4. Keyboard opening does not obscure essential controls.
5. Installability works through the browser PWA flow.
6. The Capacitor shell reaches the live hosted app successfully.
7. Crash-free startup and sign-in have been tested on a physical Android device.

## Screenshot plan

Capture at least these screens for the first internal listing:

1. Workspace home and command bar
2. Whiteboard on mobile
3. Operations builder or planning view
4. Flashcard or tutoring session

Suggested caption lines:

1. Turn ideas into clear next steps
2. Whiteboard, zoom, and plan on mobile
3. Move from notes to structured execution
4. Generate study support from real material

## Promo graphic and icon direction

Keep the visual direction literal and product-led:

- show the workspace rather than abstract AI imagery
- favor whiteboard, command, planning, and study visuals
- avoid claiming capabilities the live app does not yet expose reliably on mobile

## Release notes for internal testing

Suggested first internal-testing release note:

Initial Android wrapper for Mate-E with hosted sign-in, whiteboard workflows, planning surfaces, flashcard generation, and installable app support.

## Data safety preparation notes

Prepare truthful answers for:

- account identifiers collected
- user-provided study content collected
- uploaded files or attachments
- analytics or diagnostics collected
- server-side AI processing of submitted content

Do not claim features or permissions that the app does not currently use.

Use [docs/PLAY_STORE_DATA_SAFETY.md](docs/PLAY_STORE_DATA_SAFETY.md) for the concrete answer sheet and [docs/ANDROID_INTERNAL_TEST_CHECKLIST.md](docs/ANDROID_INTERNAL_TEST_CHECKLIST.md) for pre-release mobile QA.

Use [docs/PLAY_STORE_DISCLOSURE_MATRIX.md](docs/PLAY_STORE_DISCLOSURE_MATRIX.md) for a field-by-field Console answer matrix.

Use [docs/PLAY_CONSOLE_SUBMISSION_WORKSHEET.md](docs/PLAY_CONSOLE_SUBMISSION_WORKSHEET.md) for a paste-ready step-by-step submission worksheet.
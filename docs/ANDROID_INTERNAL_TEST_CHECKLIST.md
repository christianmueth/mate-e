# Android Internal Test Checklist

Use this before uploading the first internal-testing build and before every materially similar Android release.

## 1. Install and launch

Pass only if all are true:

- app installs on a physical Android device
- cold start succeeds without a crash
- warm start returns to a usable screen
- app icon and app name look correct on the launcher

## 2. Network and auth

Pass only if all are true:

- hosted app loads from the Capacitor shell over HTTPS
- sign-in completes without redirect loops
- protected routes still return the user to the intended destination
- sign-out and sign-back-in both work

## 3. Workspace home

Pass only if all are true:

- command bar is visible and usable on a phone viewport
- dashboard cards do not overflow horizontally
- primary actions remain reachable above the fold
- no major layout shift occurs when content loads

## 4. Whiteboard mobile UX

Pass only if all are true:

- one-finger drawing works
- two-finger pinch zoom works
- pinch can hand off back into one-finger pan cleanly
- bottom controls remain reachable on smaller screens
- whiteboard text inputs remain editable without layout breakage

## 5. Upload and generation flows

Pass only if all are true:

- PDF upload works
- PPTX upload works if supported in the tested flow
- audio or video upload works for a user-selected file
- large-file handoff to blob storage succeeds
- flashcard or study-note generation completes after upload

## 6. Keyboard and input behavior

Pass only if all are true:

- opening the keyboard does not hide the active form field permanently
- command bar text entry remains usable with the keyboard open
- note editing and text areas remain tappable
- submit buttons remain reachable after keyboard resize

## 7. Performance and stability

Pass only if all are true:

- startup feels acceptable on a mid-range Android device
- whiteboard interaction does not stutter severely during pan or pinch
- no obvious repeated reload or reconnect loop occurs
- no fatal error toast or blank screen appears during a normal session

## 8. Privacy and disclosures

Pass only if all are true:

- privacy policy is reachable at `/privacy`
- Play listing description matches live app behavior
- Data safety answers match current permissions and data flows
- no undeclared native permission has been added to `AndroidManifest.xml`

## 9. Release gate

Do not upload to production until all are true:

- `npm run build` succeeds
- `npm run android:sync` succeeds
- internal testing has been run on a physical device
- sign-in, whiteboard, and upload flows have each been tested at least once
- Play listing assets and privacy disclosures are ready
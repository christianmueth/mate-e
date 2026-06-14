# Android And Play Store Path

Mate-E already ships as a hosted Next.js app on Vercel. Because the product depends on server-side rendering, authenticated routes, and server-only AI credentials, the fastest Android path in this repo is:

1. Keep the web app as the source of truth.
2. Ship installability through the existing manifest and service worker.
3. Wrap the deployed site with Capacitor using `server.url`.
4. Build and sign the Android shell in Android Studio.

## What is already in the repo

- Installable PWA metadata through `app/manifest.ts`
- Service worker registration through `components/PwaBootstrap.tsx`
- Cached shell assets through `public/sw.js`
- Capacitor configuration through `capacitor.config.ts`
- Android helper scripts in `package.json`
- Generated native Android shell in `/android`
- Privacy policy route at `/privacy`

## Local Android commands

Install dependencies:

```powershell
npm install
```

Sync Android project files after web changes:

```powershell
npm run android:sync
```

Open the Android project in Android Studio:

```powershell
npm run android:open
```

If that command fails with `Unable to launch Android Studio. Is it installed?`, install Android Studio locally or set `CAPACITOR_ANDROID_STUDIO_PATH` to the full path of `studio64.exe`.

## Architecture note

This repo does not use `next export` for Android packaging. The current product is not a static site, so a remote Capacitor shell pointed at `https://mate-e.com` is the least risky path to a Play Store build.

## Remaining external steps

These steps still happen outside the repo:

1. Install Android Studio if it is not already available on the machine.
2. Open the project in Android Studio.
3. Generate and safeguard the signing key.
4. Build the Android App Bundle (`.aab`).
5. Create Play Store listing assets and disclosures.
6. Use `/privacy` as the starting privacy-policy URL.
7. Upload an internal-testing `.aab` before public release.

## Current validation status

These commands have already succeeded in this repo:

- `npm run build`
- `npm run android:sync`
- `npx cap add android`

The only confirmed local blocker is IDE handoff:

- `npm run android:open` failed because Android Studio is not installed or not discoverable from this environment.

## Console prep docs

- Play listing draft: `docs/PLAY_STORE_LISTING_DRAFT.md`
- Play Data safety answer sheet: `docs/PLAY_STORE_DATA_SAFETY.md`
- Play field-by-field disclosure matrix: `docs/PLAY_STORE_DISCLOSURE_MATRIX.md`
- Play Console submission worksheet: `docs/PLAY_CONSOLE_SUBMISSION_WORKSHEET.md`
- Android internal testing checklist: `docs/ANDROID_INTERNAL_TEST_CHECKLIST.md`
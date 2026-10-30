# Worklog

## Task 10 — Fix the release APK's instant crash on launch (reproduced in CI)

**Date:** 2026-10-30 · **Repo:** `OnyxAgent-mobile` (this repo)

### Request

The CI-built APK (release `build-2`/`build-3`) crashed instantly on launch on
a real device.

### What was done

- **Reproduced it without a device**: extended the workflow into a
  build → **emulator smoke test** → release pipeline. The smoke test boots a
  headless Android 15 (API 35, x86_64) emulator on the runner (KVM), installs
  the fresh APK, launches it, watches the process for 45s, and captures
  logcat / crash block / window focus / screenshot as artifacts. The GitHub
  Release is now published **only if the app survives** the smoke test.
- Hardened the smoke test along the way (each failure taught something):
  - adb calls wrapped in `timeout` (a hung `adb logcat -d` held the job until
    the 40-min timeout cancelled it, and cancelled-run logs are not kept);
  - fail-fast boot loop (emulator-process liveness + emulator.log tail in the
    job log instead of waiting out the whole timeout);
  - forced `ANDROID_AVD_HOME`/`ANDROID_USER_HOME` (avdmanager created the AVD
    where the emulator never looked — "Unknown AVD name [onyx]");
  - fixed a self-matching crash grep (the "no FATAL EXCEPTION" fallback text
    contained the search string) and `set -o pipefail` on the sdkmanager
    install whose exit code `tail` was masking.
- **Root cause** (from the captured logcat — run 6):
  `FATAL EXCEPTION: mqt_v_native — JavascriptException: Maximum update depth
  exceeded ... at ChatScreen`, with zustand's `forceStoreRerender` /
  `updateStoreInstance` frames. `ChatScreen`'s messages selector returned a
  fresh `[]` literal whenever `activeConversationId` was null — i.e. on every
  fresh install — so `useSyncExternalStore` saw a new snapshot on every
  render and React force-re-rendered in an infinite loop until the app died.
  (Typecheck and bundling can't catch this; it needed a runtime.)
  - Fix: module-level `EMPTY_MESSAGES` constant so the empty-thread snapshot
    is referentially stable. Audited every other selector — all return raw
    state refs or primitives.
- **Bonus bug caught by the smoke-test screenshot**: the closed bottom sheet
  peeked above the bottom edge on tall screens (closed-state translateY was a
  fixed 640 — shorter than the panel's max 78% of a ~915dp window). Parked
  the closed sheet a full window-height down instead.

### Verified

- Run 7 (crash fix): build ✓, smoke test ✓ (empty crash block, app focused),
  release `build-7` published.
- Run 8 (sheet-peek fix): all green again; the captured screenshot was
  vision-checked — full UI rendered (header, welcome, chips, 4 prompt cards,
  composer), **no sheet peek**, no error dialogs.
- Every push now ships an emulator-verified APK.

## Task 9 — CI: build Android APK on every push, publish to GitHub Releases

**Date:** 2026-10-30 · **Repo:** `OnyxAgent-mobile` (this repo)

### Request

Add a GitHub Actions workflow to this repo that builds an Android APK on every
push and attaches it to GitHub Releases.

### What was done

- Added `.github/workflows/android-apk.yml` ("Android APK Release"):
  - **Triggers:** every push to any branch + manual `workflow_dispatch`.
  - **Toolchain:** JDK 17 (temurin), Node 20, Bun (matches local `bun.lock`),
    `CI=true` so Expo CLI never blocks on interactive prompts.
  - **Build:** `bun install --frozen-lockfile` → `bunx expo prebuild -p android
    --no-install` (regenerates the gitignored `android/` native project) →
    `./gradlew assembleRelease --no-daemon` (Hermes, release variant).
  - **Artifact:** APK copied to
    `OnyxAgent-v<run_number>-<short-sha>.apk`, also uploaded as a workflow
    artifact (30-day retention) for intermediate builds.
  - **Release:** per-push tag `build-<run_number>`; a re-run first deletes the
    stale release/tag, then `gh release create` publishes the APK with install
    notes. Release is created by the `github-actions` bot using the built-in
    `GITHUB_TOKEN`, so no secrets setup is needed.
  - **Guardrails:** `permissions: contents: write` (minimum scope for
    releases), `concurrency` cancels superseded runs on the same ref,
    60-minute job timeout.
- Verified against a locally generated prebuild that the runner toolchain
  covers everything the build needs: compileSdk/targetSdk 35 (preinstalled on
  `ubuntu-latest`), Gradle 8.13 wrapper, NDK 27.1.12297006, Kotlin 2.0.21.
- Confirmed release APK signs with the auto-generated debug keystore
  (standard Expo template) — fine for a sideload APK, noted in the release
  body.

### Verified

- YAML parses cleanly (triggers / permissions / 12 steps enumerated).
- Local `expo prebuild -p android --no-install` succeeds — CI's generation
  step is exactly the same command.
- Gradle itself can't run in this sandbox (no Android SDK locally); the
  workflow run on GitHub is the authoritative check:
  - Run #1 failed: `Namespace 'ai.onyxagent.native' is not a valid Java
    package name as 'native' is a Java keyword` — a latent bug in `app.json`
    that only bites on Android compile.
  - Fixed by renaming the package/bundle id to `ai.onyxagent.app`
    (commit `3c8aa5b`; nothing was published under the old id).
  - Run #2 completed **green end-to-end** and published release
    [`build-2`](https://github.com/AkshayCoder48/OnyxAgent-mobile/releases/tag/build-2)
    with `OnyxAgent-v2-3c8aa5b.apk` (69.7 MB) attached — the full loop
    (push → prebuild → assembleRelease → release) is verified working.

### Notes

- The APK is signed with the debug keystore, so every build installs over the
  previous one (same signature). If a Play-Store-style upgrade path is ever
  needed, add a proper keystore via repo secrets and extend the signing
  config in `android/app/build.gradle` (after checking it into the repo).

## Task 8 — Publish the React Native app as its own repo; restore the web repo

**Date:** 2026-10-30 · **Repo:** `OnyxAgent-mobile` (this repo, new)

### Request

1. Publish the React Native (Expo) app in a **new repo** — do not keep it inside
   the web repo (`OnyxAgent-frontend-ai-multi-agent`), which is restored to the
   commit before the migration (`1703f80`, the writefile fix).
2. The RN app must replicate the **current web UI totally** and carry the three
   native animations: scroll/swipe-to-open the sidebar, chat swipe-to-close in
   real time (not after the swipe), and the scroll bulge.

### What was done

- Created `AkshayCoder48/OnyxAgent-mobile` (public, mirroring the web repo's
  visibility) and moved the Expo app here as a standalone project
  (`onyxagent-mobile/` from the web repo's `mobile/` folder).
- Kept the gesture engine verbatim — `useDrawerGesture.ts` (real-time
  1:1 `onUpdate` tracking, projection-based release, spring 320/32),
  `rubberband.ts` (×0.175 overshoot, ±24 px cap) and the bulge math
  (scale `1 + min(-y/240, 0.15)`, `translateY = y·0.5`).
- Rebuilt the UI layer to totally match the current web app:
  - `theme.tsx` — 1:1 port of the web `globals.css` tokens (dark default +
    opt-in light), DM Sans + JetBrains Mono via `@expo-google-fonts`.
  - `ConversationSidebar` — the full web structure: "Conversations" header,
    New Chat button, "Search chats" search, Active/Archived tabs with counts,
    Today/Yesterday/This week/Older date groups, long-press
    rename/archive/delete, Guest account footer with KB + Settings buttons.
  - `ChatScreen` — FlashList thread with web date separators
    ("TODAY · 2:14 PM"), user bubbles on the web `--chat-user-*` tokens,
    frameless assistant markdown, Thinking dots + streaming caret, entry
    animations, near-bottom-follow auto-scroll via `useAnimatedReaction`.
  - `EmptyState` — verbatim web ChatEmptyState (orb, "Welcome to OnyxAgent",
    subtitle, 6 feature badges, 4 prompt cards, footer) **with the bulge
    transform** on top overscroll.
  - `Composer` — glass-card composer: multiline input, LIVE/OFFLINE pill,
    model pill, send/stop button, disclaimer.
  - `ModelPickerSheet` — live `gen.pollinations.ai/models` catalogue with
    search, FREE badges, health dots, free-first ordering (web rules:
    free = all-zero rates or rate-less non-paid).
  - `SettingsSheet` — dark/light theme, Pollinations API key, default model,
    clear-all-data, about.
- Real chat integration: `POST gen.pollinations.ai/v1/chat/completions`
  `stream:true`, SSE parsed over RN's incremental XHR (progressive
  `onprogress` responseText slicing — the react-native-sse pattern); zustand +
  AsyncStorage persistence; stop button aborts mid-stream and keeps partial
  text.
- App icon + splash generated (1024×1024 PNGs in `assets/`).
- Fixed the inherited package.json (nonexistent `babel-preset-expo@~53.0.0`
  pin — deps had never actually been installed); installed everything via
  `expo install` (SDK-53-aligned: expo-font 13.3.2, AsyncStorage 2.1.2,
  vector-icons 14.1.0, font packs) + zustand 5.
- Adapted to FlashList v2 (no `estimatedItemSize`, `FlashListRef` refs, the
  official `AnimatedFlashList` export).

### Verified

- `tsc --noEmit` — clean (strict).
- `expo export --platform ios` — bundles cleanly (3.9 MB Hermes bundle).
- Live models endpoint contract confirmed (404 models, free/health fields).
- Chat endpoint requires an API key (verified live) → the app surfaces a
  connect banner + actionable error message; key entry lives in Settings.

### Not done / follow-ups

- On-device smoke test (needs a real device/simulator; not available in this
  environment) — bundle + typecheck are the verified baseline.
- Per-conversation model pinning (currently one global default model).
- Tool-calling / agent runtime stays in the web app (browser-bound).

# Worklog

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

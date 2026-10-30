# OnyxAgent Mobile

The native iOS/Android app for **OnyxAgent** — a React Native (Expo) app that
replicates the current OnyxAgent web app's chat experience **totally** (the
same dark-first cyan-on-black design, sidebar, composer, model picker and
empty state), with three fully native gesture animations running on the UI
thread.

This repo is the native counterpart of the web app
([OnyxAgent-frontend-ai-multi-agent](https://github.com/AkshayCoder48/OnyxAgent-frontend-ai-multi-agent));
the web repo stays the canonical web app.

## Setup

```bash
bun install        # or npm install
npx expo start     # scan the QR with Expo Go (iOS/Android)
```

- iOS: press `i` (needs Xcode simulator or Expo Go on a device)
- Android: press `a` (needs an emulator or Expo Go on a device)

Type-check: `bun run typecheck`

## Chat requires a Pollinations API key

The live catalogue (`GET https://gen.pollinations.ai/models`) is public, but
chat completions (`POST https://gen.pollinations.ai/v1/chat/completions`)
require a key — same as the web app's BYOP providers. Get one at
<https://enter.pollinations.ai/keys> and paste it in **Settings → API key**
(tap the ⚙ in the sidebar). Until then a connect banner guides you there and
turns explain exactly what's missing.

## The three native animations

All three run on the **UI thread** via Reanimated worklets — nothing
animates "after the gesture ends"; every frame is computed live from shared
values while the finger moves.

### 1. Scroll/swipe to open the sidebar — real time

- An invisible **28 px edge strip** over the left screen edge carries a
  `Gesture.Pan()` (activates at ±8 px horizontal, fails on ±24 px vertical so
  lists keep scrolling).
- `onUpdate` writes `x = dragStartX + translationX` **1:1 every frame** —
  the drawer, backdrop opacity, content parallax (×0.25 drift, ×0.98 scale)
  and the header's hamburger→× morph are pure functions of `x`.
- Release projects `x + velocity·0.25 s` past the halfway point (or a
  rightward fling > 500 px/s) → springs with `{stiffness: 320, damping: 32}`.

### 2. Chat swipe-to-close — real time (not after the swipe)

- The drawer surface and the backdrop each carry their own pan; while the
  finger moves, `x` follows it live through `rubberBandClamp` — overshoot
  past either edge maps sub-linearly (× 0.175) and hard-caps at ±24 px.
- The release settles from **wherever the finger left off**, never from a
  pre-set position. Tap the backdrop (raced with the pan) springs it closed.

### 3. Scroll bulge (rubber-band)

- Every list (messages, sidebar, model picker) runs `bounces` (iOS) +
  `overScrollMode="always"` (Android 12+ native stretch).
- On top of that, the empty state **bulges** under a top overscroll:
  `scale = 1 + min(-y / 240, 0.15)` (+15 % cap) and
  `translateY = y · 0.5`, driven by a `useAnimatedScrollHandler` worklet at
  16 ms sampling.

## Architecture

```
App.tsx                     # fonts (DM Sans + JetBrains Mono), theme, sheets
src/
  theme.tsx                 # web globals.css tokens — dark + light palettes
  types.ts                  # Conversation / Message / ModelInfo / Settings
  store.ts                  # zustand + AsyncStorage: chats, settings, streaming
  hooks/useDrawerGesture.ts # the drawer engine (all three pan gestures)
  lib/pollinations.ts       # live model catalogue + XHR-progressive SSE chat
  lib/rubberband.ts         # rubberBandClamp worklet
  lib/markdown.tsx          # dependency-free markdown renderer
  components/
    AppDrawer.tsx           # layer stack: content / edge strip / backdrop / drawer
    ChatScreen.tsx          # thread (FlashList + day separators) or empty state
    ChatHeader.tsx          # morphing menu + title + model chip
    ConversationSidebar.tsx # Conversations header, New Chat, search, tabs,
                            # date-grouped list, rename/archive/delete, account
    MessageBubble.tsx       # web bubble tokens, markdown, thinking + caret
    Composer.tsx            # glass card, LIVE pill, model pill, send/stop
    EmptyState.tsx          # web ChatEmptyState (orb, badges, prompts) + bulge
    Sheet.tsx               # reusable animated bottom sheet
    ModelPickerSheet.tsx    # live Pollinations models, search, free-first
    SettingsSheet.tsx       # appearance, API key, default model, data reset
```

### Data flow

- **Models**: `GET https://gen.pollinations.ai/models` → normalized with the
  web rules (free = all-zero rates or rate-less non-paid; free & healthy
  first; unavailable last).
- **Chat**: `POST https://gen.pollinations.ai/v1/chat/completions` with
  `stream: true` — parsed as SSE over React Native's incremental XHR
  (`onprogress` delivers partial `responseText`, the react-native-sse
  pattern), so deltas render as they arrive.
- **Persistence**: zustand `persist` on AsyncStorage
  (`onyxagent-mobile-store`) — conversations, messages, settings and the
  selected model survive restarts.

## Scope vs. the web app

This app fully replicates the web app's **chat experience**: conversation
management, live model picking, streaming chat, markdown answers, both
themes. Web-bound capabilities that depend on the in-browser agent runtime
(tool execution, E2B sandboxes, business agent swarm, knowledge base,
browser automation) remain in the web app — the mobile app focuses on chat.

## Scripts

| Script | What it does |
| --- | --- |
| `bun start` | `expo start` (dev server for Expo Go) |
| `bun run ios` / `bun run android` | start for a specific platform |
| `bun run typecheck` | `tsc --noEmit` |

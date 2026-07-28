# UI + MTG-Arena-Style Animation System — design spec (M2)

> Produced during the planning session on 2026-07-26 and preserved here verbatim.
> This is a DESIGN SPEC, not a record of what is built — check AGENTS.md
> "Milestone status" for what actually exists, and docs/DECISIONS.md for places
> where implementation deliberately diverged from this document.

---

# UI + MTG-Arena-Style Animation System — Implementation Plan

## 0. Verified facts this plan rests on

| Claim | Verified |
|---|---|
| `motion` is the successor package; `framer-motion` is frozen | `motion@12.42.2`, `peerDependencies.react: "^18.0.0 \|\| ^19.0.0"`, depends on `framer-motion@^12.42.2`. Import from **`motion/react`**. |
| `animate()` returns `AnimationPlaybackControls` | Has `time`, **`speed`**, `duration`, `play/pause/complete/cancel/stop/then`. `speed` is what makes hold-to-fast-forward possible; `complete()` is what makes skip possible. |
| Sequences + stagger exist | `animate([[el, kf, {at:"<0.06"}], …])`, `stagger(0.06, {from:'first'})`. |
| Spring API | `{type:'spring', visualDuration, bounce}` (bounce default 0.25) or `{stiffness, damping, mass}`. |
| `MotionConfig` | props: `transition`, `reducedMotion: 'user'\|'always'\|'never'`, **`nonce`**. Reduced motion kills transform + layout, keeps opacity/colour. |
| Scryfall max fidelity | `png` = **745×1040** PNG w/ transparent rounded corners. `large` 672×936, `normal` 488×680, `border_crop` 480×680, `art_crop` variable. **745×1040 is the ceiling — always request `png`.** |
| Fonts on npm | `@fontsource-variable/alegreya@5.3.0`, `@fontsource/alegreya-sc@5.3.0`, `@fontsource-variable/crimson-pro@5.3.0`, `@fontsource-variable/cinzel@5.3.0`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`. **Beleren is WotC-proprietary and is not on fontsource.** |
| Mana symbols offline | `mana-font@1.18.0` (Andrew Gioia, SIL OFL 1.1 fonts / MIT code) ships woff2 locally. `keyrune@3.19.0` for set symbols. |
| Chromium floor | Electron 42.7.0 (installed in mundifex) / 43.2.0 = Chromium 150. LoAF (`long-animation-frame`) needs 123 → available. |
| Reference stack | `H:\Claude Apps\mundifex\package.json`: React 19.2.4, Vite 8, Tailwind 4.2.1 + `@tailwindcss/vite`, zustand 5.0.11, lucide-react 1.21.0, electron 42.7.0. Copy this shape. |
| Known risk | Motion + React 19 TS friction is reported when **two copies of `@types/react`** resolve. Add an npm `overrides` pin. |
| Known risk | Motion injects a `<style>` block → under a hardened Electron CSP you must pass `MotionConfig nonce`. |

Ports already taken in the workspace: 5173, 5183, 5193, 5240, 5260, 5273. **Use 5280, `strictPort`.**

Placeholder identity used throughout (see §9 Decision 1): app dir `H:\Claude Apps\roundtable`, token prefix `--rt-*` / `--color-rt-*`, dev handle `window.__rt`.

---

## 1. Screen map + routing

**Recommendation: no router library.** `uiStore.screen` discriminated union + a `ScreenHost` using the cartapriscus `.stage-slot` pattern (`H:\Claude Apps\cartapriscus\src\shell\theme.css:428-438`).

Three decisive reasons:
1. No URL bar, no deep links, no server — react-router's data APIs buy nothing.
2. **The table must never unmount.** It owns the socket, the decoded-image cache, ~50 live MotionValues, and the choreographer queue. Unmounting mid-game = desync + a re-download storm. cartapriscus learned this with Pixi; same lesson, different renderer.
3. Screen transitions are one crossfade, not a routing problem.

```ts
// src/store/uiStore.ts
type Screen =
  | { k: 'home' } | { k: 'profile' }
  | { k: 'decks' } | { k: 'deck'; deckId: string } | { k: 'deckImport' }
  | { k: 'database' }
  | { k: 'lobby'; role: 'host' | 'join' }
  | { k: 'settings'; section?: SettingsSection }
  | { k: 'table' };

interface UiStore {
  screen: Screen; history: Screen[];
  push(s: Screen): void; replace(s: Screen): void; back(): void;
  tableLive: boolean;        // a game is in progress
  tableVisible: boolean;     // screen.k === 'table'  → drives digest mode
}
```

`Alt+Left` → `back()`. `Esc` closes the topmost overlay first, then navigates. When `tableLive && !tableVisible`, the TitleBar shows a persistent brass "Return to table · ⏎" pill, and **the choreographer switches to digest mode** (§4.6) — it keeps consuming events and committing state, it just stops flying clones. It must never pause, or you desync.

App shell:

```
┌ TitleBar 36px  frameless drag region · mark · [Return to table] · − □ ×
├ ScreenHost  flex-1, position:relative
│   .screen-slot[data-k=table]  ← always mounted, display:none when inactive
│   .screen-slot[data-k=other]  ← the active non-table screen (crossfade 180ms)
├ FlightLayer    fixed, z 900, pointer-events:none, perspective:1400px
├ FxCanvas       fixed, z 920, pointer-events:none
├ CardZoomPanel  fixed, z 940      (above FX — never spark over text you're reading)
├ DialogHost     fixed, z 960      ⚠️ replaces window.prompt everywhere
└ Toasts         fixed, z 980
```

Screens beyond the table are conventional and can lag the table in build order: `HomeScreen`, `ProfileScreen`, `DecksScreen`, `DeckEditorScreen`, `DeckImportScreen` (paste/`.txt` → parse → EDH validation report: 100 cards, singleton, colour identity, legality, banlist), `CardDatabaseScreen` (Scryfall bulk-data sync + image-cache progress bar with two tracks: oracle JSON, then images `n/N` + MB/s + ETA), `LobbyScreen` (room code, seat order drag, deck picks, ready state), `SettingsScreen`.

---

## 2. Component tree for the table

Full file layout. Everything under `H:\Claude Apps\roundtable\src\`.

```
main.tsx
index.css                       @import 'tailwindcss' + fonts + @theme (§7)
engine/                         (out of scope here — pure deterministic engine)
net/                            (out of scope — host/client transport)
view/
  types.ts                      PlayerView, CardView, ZoneView, EngineEvent  ← the contract
  selectors.ts                  memoized derivations off PlayerView
store/
  gameStore.ts                  { view, epoch, log[], applyView(), applyEvents() }  ← authoritative
  animStore.ts                  { inFlight:Set<string>, clones[], badges[], rowSweeps, hardSyncFlash }
  layoutStore.ts                { metrics: TableMetrics, metricsEpoch }
  promptStore.ts                the live engine prompt + local picks — NEVER lags (§4.7)
  settingsStore.ts              persisted: animationSpeed, tapAngle, stops, stacking, theme
  uiStore.ts                    screen/history/panels/zoomTarget/dialogs
ui/
  App.tsx                       providers + MotionConfig + dev handle
  shell/  AppShell.tsx TitleBar.tsx ScreenHost.tsx Toasts.tsx DialogHost.tsx
  common/ TextPromptDialog.tsx NumberPromptDialog.tsx ConfirmDialog.tsx
          Segmented.tsx Slider.tsx NumField.tsx Tooltip.tsx ProgressBar.tsx ScrollArea.tsx
  screens/ HomeScreen.tsx … TableScreen.tsx
  table/
    GameTable.tsx               owns useTableMetrics; renders the CSS grid
    TableSurface.tsx            felt + vignette + noise + inlay ring (§7)
    SeatLayout.ts               PURE: (seatCount, viewport) => SeatBox[]   ← unit-testable
    OpponentPod.tsx             header + 2 bands + piles + expand affordance
    PlayerSeat.tsx              my header + 2 bands + piles + hand host
    BattlefieldBand.tsx         'combat' | 'support'; owns grouping + packing
    BattlefieldRow.tsx          one packed row
    PermanentStack.tsx          identical-permanent pile w/ count badge
    HandFan.tsx                 fan geometry + hover choreography
    HandCard.tsx                one fan slot
    StackDisplay.tsx            LIFO column, newest on top
    StackItem.tsx               card or ability chit + target arrows
    ZonePile.tsx                graveyard / exile / library / command zone
    ZonePileSheet.tsx           click a pile → grid browser overlay
    CombatLane.tsx              the middle band during combat
    TargetArrows.tsx            one SVG layer for all target/attack/block links
  card/
    Card.tsx                    mode: 'full' | 'chit' | 'back' | 'pile'
    CardFace.tsx                the Scryfall <img> + skeleton + crossfade upgrade
    CardArt.tsx                 art_crop path (chit mode)
    SyntheticFace.tsx           the no-image-yet playable face (§5)
    CardFrameChrome.tsx         our overlay: name strip, sick ring, target ring, veil
    ManaCost.tsx                mana-font pips
    PowerToughness.tsx          our own CURRENT P/T badge — always drawn
    CounterBadges.tsx           +1/+1, loyalty, charge, …
    DamageMarker.tsx            marked damage this turn
    AttachmentStack.tsx         auras/equipment tucked under the host
    FaceSwitcher.tsx            DFC / adventure / split peek + flip
    CardZoomPanel.tsx           620px-tall hover preview, full oracle text
    useCardImage.ts             cache → mtgimg:// URL, 4-step fallback
  hud/
    PlayerPlate.tsx  LifeCounter.tsx  CommanderDamageMatrix.tsx  ManaPool.tsx
    PhaseTrack.tsx   PriorityIndicator.tsx  TurnBanner.tsx  GameLog.tsx  RightRail.tsx
  prompt/
    PromptBar.tsx               the single interaction surface (role="status")
    TargetPicker.ts             legality highlight + hit-testing
    CostPaymentPanel.tsx        auto-tap review / manual mode
    DeclareAttackersBar.tsx  DeclareBlockersBar.tsx  ChoiceModal.tsx  StopsPolicyPanel.tsx
  tools/
    ManualToolsPanel.tsx        Tier-3 drawer (right rail, Ctrl+M)
    MoveCardTool.tsx TokenTool.tsx CounterTool.tsx LifeTool.tsx ManaTool.tsx
    RevealTool.tsx DiceTool.tsx CoinTool.tsx  CardContextMenu.tsx
  anim/
    tokens.ts                   DUR / EASE / SPRING / STAGGER + timeScale
    motionConfig.tsx            <MotionConfig reducedMotion="user" nonce={…}>
    rectRegistry.ts             the ONLY place getBoundingClientRect is legal
    useSlotRect.ts              ref-callback hook (React 19 cleanup-returning refs)
    FlightLayer.tsx             portal overlay + clone renderer
    flightLayer.ts              module singleton: fly() / cancel() / cancelAll()
    choreographer.ts            queue, groups, lanes, governor, watchdog, epochs
    eventToBeats.ts             the mapping table
    beats/  draw.ts cast.ts resolve.ts tap.ts combat.ts damage.ts death.ts token.ts reveal.ts
    variants.ts                 shared declarative variant objects
    useCountUp.ts               MotionValue-based, retargeting
    fx/  FxCanvas.tsx  particles.ts  fxBus.ts
    perf.ts                     rAF sampler + LoAF observer + scenario harness
```

### State ownership rules

| Where | What | Why |
|---|---|---|
| **zustand** | `gameStore.view`, `epoch`, `log`; `animStore` (inFlight/clones/badges); `layoutStore.metrics`; `promptStore`; `settingsStore` (persisted); `uiStore` | Anything two distant components need, or anything `choreographer.ts` (plain TS, no hooks) must touch. |
| **component state** | hover index, focus, local drag, single-popover open/closed, text buffers | Never leaves the subtree. |
| **MotionValue (not React state)** | life totals, mana pool counts, phase marker x, damage badge x/y, flight `progress` | **The key perf move.** These change every frame; a MotionValue writes straight to the DOM with zero React re-render. A life total counting 40→28 must not re-render the seat 30 times. |
| **derived selectors** | `selectBands(view, pid)`, `packRow(band, metrics)`, `selectStackItems(view)` | Memoized, keyed on `layoutStore.metricsEpoch`. Use `useShallow` from `zustand/shallow`. |

---

## 3. Layout math for 2/3/4 players at 1080p

Card aspect ratio **0.716** (63×88 mm).

### Card size tokens (written to the table root as CSS vars by JS)

| Token | Height | Width | Where |
|---|---|---|---|
| `--card-h-hand` | 208 | 149 | my hand |
| `--card-h-bf` | 148 | 106 | my battlefield |
| `--card-h-bf-opp` | **148 / 132 / 116** (2p / 3p / 4p) | 106 / 94 / 83 | opponent battlefields |
| `--card-h-stack` | 132 | 94 | stack items |
| `--card-h-pile` | 92 | 66 | graveyard/exile/library/command tops |
| `--card-h-min` | **96** | 69 | hard floor → below this, `chit` mode |
| `--card-h-zoom` | 620 | 444 | zoom panel (0.596 downscale of the 1040-tall png ⇒ crisp) |

2-player is deliberately **symmetric at 148** — that's what Arena does and it reads better than a bigger opponent.

### Vertical budget, 4 players, 1920×1080 frameless

```
 36  TitleBar
 30  PhaseTrack strip
296  Opponent strip — 3 pods side by side, each:
       34  pod header (name · life · cmd-dmg chips · mana pool · commander colour underline)
      120  combat band   (116 card + 4 pad)   ← nearest the middle of the table
      120  support band  (116 card + 4 pad)
       22  inner gaps
148  Middle band — stack (right of centre) + combat lane + turn banner
358  My seat —  34 header + 154 combat band + 154 support band + 16 gaps
176  Hand band — cards are 208 tall, bottom 32 px clipped below the viewport edge
─────
1044  + 36 px of distributed gaps = 1080 ✓
```

3-player: 2 pods at 328 tall → 1076. 2-player: 1 pod at 360, middle band 128, my bands 148 → 1078. All fit.

### Horizontal, 1920

Right rail 272 px expanded / 44 px collapsed → table = 1648 / 1876.

| Seats | Pod width | Inner row width | Cards per row (no overlap) |
|---|---|---|---|
| 4 | 530 | 510 | **5** (w 83, gap 8) |
| 3 | 802 | 782 | 7 (w 94, gap 8) |
| 2 | 1616 | 1596 | 13 (w 106, gap 10) |
| mine | 1616 | 1596 | 13 |

**5 slots per band at 4 players is the whole design problem.** A Commander board is 10 lands + 6 other noncreatures + 5 creatures.

### `packRow` — the resolution ladder

**Battlefield rows never overlap.** (Arena doesn't either — Arena overlaps only the *hand*. A horizontal overlap hides the right edge of the covered card, which is where the P/T is.) The ladder, applied in order:

1. **Natural fit** — `pitch = cw + gap`, row centred.
2. **Auto-stack identical permanents** → §9 Decision 3. Same oracle id + same tap state + same counters + no attachments collapse into one `PermanentStack`: top card visible, hidden cards drawn as a 3-step offset (`x+3, y−3`, max 3 visible), count badge `×12`, sub-badge `7/12 untapped`. Clicking taps one; `Shift+click` opens the pile. **This is what makes 10 lands occupy 4 slots instead of 10.** Load-bearing at 4p.
3. **Shrink** — uniform `scale ∈ [0.83, 1]`, floored so `h ≥ 96`.
4. **Horizontal scroll** with a persistent `+N` chip (wheel + drag-scroll, `scroll-snap-type: x proximity`).
5. **Expand pod** — click the pod header → it animates into the middle band as a full-width overlay (`320 ms`, `EASE.out`, scale from the pod's rect via a flight-layer-style FLIP). `Esc` closes. This is the honest answer for an 18-permanent pod at 1080p, and it's a good feature regardless.

### Battlefield grouping (Arena-style)

Two bands per seat, the combat band always **nearest the middle of the table** (mirrored for opponents — their creatures at the *bottom* of their pod):

- **Combat band**: creatures, planeswalkers, battles.
- **Support band**: three left-to-right clusters separated by a 24 px gap — **lands** (leftmost; most numerous, most stacked) → **artifacts** → **enchantments**. A 9 px uppercase micro-label per cluster fades in on band hover only.
- **Auras and equipment are not in a band.** They tuck under their host: `AttachmentStack` renders each attachment at `scale 0.86`, offset `y += 13 px` per attachment, `z` below the host, max 3 visible + a `+N` chip. The host's row slot grows by `13 × min(n,3)` in height, which the band accounts for when computing its own height.

### Hand fan geometry

```ts
// cw = 149, ch = 208, bandW = tableW - 48
pitch      = n > 1 ? clamp((bandW - cw) / (n - 1), 46, 118) : 0
totalW     = pitch * (n - 1) + cw
x_i        = (bandW - totalW) / 2 + i * pitch
totalSweep = min(30, n * 4.6)                    // degrees, capped
angleStep  = n > 1 ? totalSweep / (n - 1) : 0
theta_i    = (i - (n - 1) / 2) * angleStep       // ±15° max
droop_i    = 16 * (theta_i / thetaMax) ** 2      // px; edges sit 16px lower
z_i        = i                                   // later cards on top
transformOrigin = '50% 190%'                     // pivot below the card ⇒ reads as a fan
```
n=7 → pitch 118, sweep ±15°, edge droop 16 px. n=24 → pitch 63, same sweep. Beyond **32 cards** the fan overflows at min pitch → `handMode: 'list'`, a 69×96 chit scroller. Specify it; Commander does produce 30-card hands.

### Scaling strategy: **JS scale factor, not `clamp()`/container queries**

Card size drives fan geometry, pile offsets, row packing, *and* the flight-layer arc math — all of which are JS. Container queries cannot feed the flight layer. So:

```ts
// src/ui/table/useTableMetrics.ts
interface TableMetrics {
  seatCount: 2|3|4; tableW: number; tableH: number;
  cardH: Record<'hand'|'bf'|'bfOpp'|'stack'|'pile'|'zoom', number>;
  cardW: Record<…, number>;
  bandH: { combat: number; support: number; oppCombat: number; oppSupport: number };
  seats: SeatBox[];             // from the pure SeatLayout.ts
  rowGap: number; fanPitchCap: number; tapAngleDeg: number;
  scale: number;                // global degrade factor for <1600px viewports
}
```
One `ResizeObserver` on the table host, **rAF-coalesced** (not a timer). It writes `layoutStore.metrics` *and* stamps the same numbers as CSS custom properties on `.rt-table` so Tailwind arbitrary values (`h-[var(--card-h-bf)]`) work. One source of truth, both worlds.

`clamp()` is used for exactly one thing: type size inside cards, `font-size: clamp(9px, calc(var(--card-h) * 0.062), 13px)`. Container queries for exactly one thing: the right rail's collapsed/expanded content.

**Resize invalidates the flight layer.** `useTableMetrics` bumps `metricsEpoch`; the flight layer discards clones whose captured rects predate it and snaps them to their destination immediately. Correct behaviour — a 400 ms flight to a rect that moved 300 px is worse than a snap.

Electron `minWidth: 1280, minHeight: 800`. At 1280×800 with 4 seats, pods collapse to a single band + expander and cards go to the 96 px floor.

---

## 4. The animation system

### 4.1 The flight mechanism — decision

| Approach | Verdict |
|---|---|
| `layoutId` + `LayoutGroup` | **Rejected.** (a) The animating element lives in its *new* DOM parent → `overflow:hidden` on hand/band/rail **clips the in-flight card**, and it can't be raised above a sibling panel's stacking context. (b) It matches sizes with `transform: scale()`, distorting all ~20 card sub-elements; counter-scaling needs `layout` on every child. (c) `layout` owns the transform, so the mid-flight `rotateY` flip needs a nested wrapper. (d) It's render-driven — you cannot sequence, throttle, coalesce, or skip 6 simultaneous layout animations. Our whole backpressure design becomes impossible. |
| **Portal flight layer + FLIP on a clone** | **✅ Recommended.** One fixed overlay above everything: never clipped, always on top, full control over arc/flip/glow/overshoot, trivially sequenced and cancellable, and it's *rect-to-rect* — so arbitrary zone→zone (the Tier-3 tool) is the default path, not a special case. |
| View Transitions API | **Rejected**, and the reason is verifiable: **only one transition can run at a time** — a second `startViewTransition` skips the first. A Commander table routinely animates 3 things at once. Also snapshots to bitmaps and gives near-zero control over the flight path. |

**Consequence: no `layoutId` anywhere in this app.** Two mechanisms only:
- **Local beats** = declarative `animate`/`variants` on cards *inside* their zone (tap, lift, thump, fan reflow, hover, shimmer).
- **Zone→zone** = the imperative flight layer.

Note the hand fan is absolutely positioned with computed `x/rotate/y`, so `layout` would be useless there anyway — we animate the computed values, which gives exact control over neighbours parting.

### 4.2 Rect registry

```ts
// src/ui/anim/rectRegistry.ts
type ZoneId  = `${'hand'|'bf'|'gy'|'exile'|'lib'|'cmd'}:${PlayerId}` | 'stack';
type SlotKey = `card:${string}` | `zone:${ZoneId}`;

interface RectRegistry {
  register(key: SlotKey, el: HTMLElement): () => void;
  /** The ONLY legal caller of getBoundingClientRect in the app.
   *  Reads every key back-to-back with zero interleaved style writes. */
  readAll(keys: SlotKey[]): Map<SlotKey, DOMRectReadOnly>;
  /** card slot → zone anchor → viewport centre. NEVER throws, NEVER returns null. */
  resolve(cardId: string, zone: ZoneId): DOMRectReadOnly;
  metricsEpoch: number;
}
```

```ts
// src/ui/anim/useSlotRect.ts
function useSlotRect(key: SlotKey): (el: HTMLElement | null) => void;
```
Implemented as a **React 19 cleanup-returning ref callback** — `ref={el => registry.register(key, el)}` where `register` returns the unregister function. React 19 calls that cleanup on unmount; no `useEffect`, no null-call dance.

**Every card slot registers `card:<instanceId>`. Every zone registers `zone:<zoneId>` on an anchor element** (the pile top, the hand-count chip, the library stack). That three-tier resolution is precisely what makes "move any card anywhere" work without hand-written cases: hidden zones expose only an anchor, collapsed pods expose only an anchor, and the viewport centre is the never-fails floor.

### 4.3 Flight layer API

```ts
// src/ui/anim/flightLayer.ts  — a MODULE SINGLETON (choreographer.ts is plain TS, no hooks;
//                                same precedent as cartapriscus engineSingleton)
interface FlightSpec {
  instanceId: string;
  epoch: number;                                    // discarded if ≠ current epoch
  from: DOMRectReadOnly | SlotKey;
  to:   DOMRectReadOnly | SlotKey;
  faceUpAtStart: boolean;
  faceUpAtEnd: boolean;                             // drives the rotateY flip at t=0.5
  arc: number;                                      // 0 straight … 0.22 draw
  durationMs: number;
  ease?: keyof typeof EASE;
  spinDeg?: number;                                 // rotateZ delta
  glow?: string;                                    // oklch() — a travelling drop-shadow
  landing?: 'thump' | 'settle' | 'drop' | 'none';
  faceMode?: 'full' | 'chit' | 'back';
  z?: number;
}
interface FlightLayerApi {
  fly(spec: FlightSpec): Promise<void>;   // resolves on land OR on cancel — never rejects
  cancel(instanceId: string): void;       // snaps to destination, resolves
  cancelAll(): void;
  activeCount(): number;
}
export const flightLayer: FlightLayerApi;
export function useFlightLayer(): FlightLayerApi;   // thin hook wrapper
```

`FlightLayer.tsx` subscribes to the singleton's clone list and renders them. `pointer-events: none`, `perspective: 1400px` on the **layer** (one shared vanishing point reads as a real table; per-card perspective does not).

**Arc math** — quadratic bezier, one control point:
```
d    = to.center − from.center ;  dist = |d|
nrm  = (−d.y, d.x) / dist
s    = ((from.y + to.y) / 2 > viewportH / 2) ? +1 : −1   // bow away from the nearest edge
ctrl = midpoint + nrm * (arc * dist * s)
P(t) = (1−t)²·from + 2(1−t)t·ctrl + t²·to
```

**Per-flight cost: one animation, zero React renders.**
```ts
const progress = useMotionValue(0);
const x = useTransform(progress, [0,.32,.5,.68,1], [x0, P(.32).x, P(.5).x, P(.68).x, x1]);
const scale    = useTransform(progress, [0,.32,.5,.68,1], [.62,.92,1.14,1.10,1]);
const rotateY  = useTransform(progress, [0,.5,.68,1], [180,90,0,0]);
const controls = animate(progress, 1, { duration: ms/1000, ease: EASE[ease] });
// controls.speed = 4  → hold-to-fast-forward
// controls.complete() → skip
```

**Handoff protocol (the flash-free part).** Commit-then-fly:
1. Read the source rect **before** any state write (`readAll` on all cards in the group — one forced layout, batched).
2. `animStore.inFlight.add(instanceId)` + commit the view.
3. React renders: the destination slot renders the card with `visibility: hidden` (it still occupies layout, so the destination geometry is final) — the source zone no longer has it, so **the hand re-fans immediately while the card flies**, which is exactly Arena.
4. In the post-commit `useLayoutEffect`, read the destination rect and start the clone.
5. On land: `inFlight.delete()` → the real card becomes visible in the same frame the clone unmounts.

Fallback if the destination slot isn't registered within one frame (collapsed pod, off-screen zone): `resolve()` returns the zone anchor. No special case needed.

### 4.4 Motion token table

```ts
// src/ui/anim/tokens.ts
export const DUR = {
  microTap:     120,   hoverLift:    160,   tap:          180,
  zoomIn:       140,   fanReflow:    220,   counterNudge: 220,
  landDrop:     200,   landThump:    260,   resolve:      300,
  blockSlide:   300,   revealFlip:   340,   attackLunge:  340,
  flourish:     360,   draw:         420,   deathDrop:    440,
  damagePunch:  480,   castFlight:   520,   lifeCount:    520,  // see formula
  podExpand:    320,   diceRoll:     700,
} as const;

export const STAGGER = {
  draw: 60,  fanArrive: 28,  untapSweep: 34,  attackers: 50,  blockers: 40,  stackSlideUp: 40,
} as const;

export const EASE = {
  out:       [0.16, 1,    0.30, 1   ],  // expo-out — the workhorse settle
  outSoft:   [0.22, 1,    0.36, 1   ],
  in:        [0.50, 0,    0.75, 0   ],
  inOut:     [0.65, 0,    0.35, 1   ],
  flight:    [0.30, 0.05, 0.20, 1   ],  // fast middle, gentle ends → reads as "thrown"
  overshoot: [0.34, 1.56, 0.64, 1   ],  // the Arena signature
  impact:    [0.20, 0.90, 0.10, 1.02],  // slam then micro-rebound
} as const;

export const SPRING = {
  tap:    { type:'spring', stiffness: 520, damping: 26, mass: 0.7 },   // ≈180ms visual
  settle: { type:'spring', visualDuration: 0.26, bounce: 0.34 },       // hand arrival
  lift:   { type:'spring', visualDuration: 0.16, bounce: 0.12 },       // hover lift
  thump:  { type:'spring', visualDuration: 0.22, bounce: 0.42 },       // battlefield landing
  fan:    { type:'spring', visualDuration: 0.22, bounce: 0.10 },       // neighbours parting
  nudge:  { type:'spring', stiffness: 700, damping: 30, mass: 0.6 },   // badges ticking
} as const;

/** Every duration in the app goes through this. Never hard-code ms in a component. */
export function d(ms: number): number {
  return ms / useSettings.getState().timeScale;   // 1.0 | 1.4 | 2.2 | Infinity
}
```

**Why these numbers read as Arena:** nothing exceeds 520 ms except the life counter; the settle always overshoots (`EASE.overshoot` peaks at 1.56, `bounce 0.34–0.42`); the flight ease front-loads velocity so the card *launches* rather than eases out of the library; taps are 180 ms so the board never feels gummy. Arena's own cast-to-stack reads at roughly 0.4–0.6 s and its taps are near-instant.

### 4.5 Variant specs per beat

**1 · Draw — library → hand · 420 ms · stagger 60 ms**
```
arc 0.22, faceUpAtStart false, faceUpAtEnd true, landing 'settle', glow none
t      0.00    0.32    0.50    0.68    1.00
pos    P(0)    P(.32)  P(.50)  P(.68)  dest        ease EASE.flight
scale  0.62    0.92    1.14    1.10    1.00        ease EASE.out
rotateY 180    180     90      0       0           ease EASE.inOut   ← crosses edge-on at apex
rotateZ −8     −4      0       +2      fanAngle
brightness .90  1.0    1.0     1.0     1.0
→ handoff: real hand card runs SPRING.settle  y:[+10,0]  scale:[1.06,1]
```
`transformStyle: preserve-3d` on the clone; front and back both `backface-visibility: hidden`, back pre-rotated `rotateY(180deg)`. Multi-draw: `stagger = min(60, 420/n)` so a 7-card opening hand takes 420 + 6×60 = 780 ms, not 4 s. Opponent draws: `faceMode:'back'`, `faceUpAtEnd:false`, destination = the opponent hand-count chip anchor, and the chip's number runs `SPRING.nudge`.

**2 · Hand hover**
```
hovered:      y −= 54,  scale 1.10,  rotate → 0deg,  z 1000,
              drop-shadow(0 18px 24px oklch(0 0 0 / .55))       SPRING.lift
neighbours:   x += sign(i−h) * 26 * exp(−|i−h| * 0.55)          SPRING.fan
              → 26, 15.0, 8.6, 5.0, 2.9 px
intent:       90 ms open delay, 60 ms close delay (no strobing on a sweep)
zoom panel:   opens at 180 ms sustained hover, DUR.zoomIn 140, scale [0.96,1] + opacity [0,1]
```

**3 · Cast from hand → stack · 100 ms lift + 520 ms flight**
```
lift (100ms, EASE.out):   y −54→−84,  scale 1.10→1.16,  rotate→0
commit → hand re-fans concurrently (SPRING.fan, DUR.fanReflow 220)
flight, arc 0.18:
t      0.00    0.18    0.62    1.00
pos    lift    P(.18)  P(.62)  stackSlot     ease EASE.flight
scale  1.16    1.20    0.78    0.635         ease EASE.inOut   (132/208 = 0.635)
rotateZ 0      −3      +2      0
glow: travelling drop-shadow 0 0 22px <colourIdentity glow>, alpha 0→.5→.35
```

**4 · Stack arrival flourish · 360 ms · starts at flight t=0.86**
```
slot box-shadow  0 0 0 0 rgba(C,0) → 0 0 26px 6px rgba(C,.55) → 0 0 14px 2px rgba(C,.28)
                 times [0, .45, 1]
card scale       [1, 1.06, 1]                    EASE.overshoot
outline          1px → 2px --color-rt-accent
FX canvas        burst: n 26, speed 60–170 px/s, life 380–620 ms, size 2–5, hue = colour identity
                 + ring: r 8→64px, lineWidth 3→0.5, alpha .7→0, 320 ms
```

**5 · Resolve → battlefield · 300 ms flight + 260 ms thump**
```
flight arc 0.10, pos ease EASE.in over the last 40% (it accelerates DOWN into the slot)
scale 0.635 → 1.0 (relative to the clone's own basis)
thump on the REAL card, SPRING.thump (visualDuration .22, bounce .42):
  scaleY  [1, 0.90, 1.04, 1]   times [0, .18, .52, 1]
  scaleX  [1, 1.08, 0.98, 1]
  y       [0, +5,   −2,   0]
  shadow  drop-shadow(0 2px 3px) → (0 14px 22px) → (0 6px 10px)   times [0,.2,1]
FX: 14 dust particles along the bottom edge, vy −40…−90 px/s, gravity +140 px/s²,
    life 320–480 ms, hue = colour identity (creature) / 40 warm (land)
```
**Land drop variant (200 ms, deliberately quiet — lands happen 40× a game):** no dust, no ring. `scaleY [1, 0.94, 1]` + one 8 px expanding rounded-rect flash in the land's colour. That restraint is what keeps the table from feeling like a slot machine.

**6 · Summoning-sickness shimmer** — CSS only, composited:
```css
.rt-sick::after{
  inset:0; border-radius:inherit; mix-blend-mode:screen; pointer-events:none;
  background:linear-gradient(105deg,transparent 38%,oklch(1 0 0/.16) 50%,transparent 62%);
  background-size:260% 100%;
  animation: rt-shimmer 2600ms var(--ease-in-out) infinite;   /* mirrors mf-shimmer */
  will-change: background-position;
}
```
Only `background-position` animates. Budget: shimmer runs **only on my creatures, only during main1/main2**; opponents' sick creatures get a static 1 px dashed inner ring. Cheaper and far less noisy at 4 players.

**7 · Tap · 180 ms · `SPRING.tap`**
```
rotate           0 → var(--tap-angle)     default 20.5deg   (see Decision 4)
x, y             0 → +6px, +2px           it "leans"
brightness       1 → 0.78 ;  saturate 1 → 0.85
transformOrigin  50% 62%                  low-centre pivot = a real card being turned
untap-all        same, reversed, stagger 34ms, from:'first' (left→right)
                 + one row sweep: a 240ms translateX gradient wipe across the row
```
20.5° keeps rows tidy *and* is unmistakable. At 90° the row packer must reserve `max(cw, ch)` per slot — make that a metrics branch.

> ⚠️ **SUPERSEDED — Decision 4 was answered `90°` (2026-07-27).** The tap is a full
> quarter turn to the right, anchored on the slot's top-left corner, and the row
> packer reserves the turned box **per tapped slot** rather than `max(cw, ch)` for
> every slot. The lean, and the `50% 62%` pivot that shaped it, are gone. See
> **D75** — including why the per-slot version is affordable where the spec's
> per-row version would not have been.

**8 · Attack lunge · 340 ms · stagger 50 ms**
```
u = unit vector from attacker centre → defending pod centre
pos     0 → u * LUNGE      LUNGE = 46px (2p) / 38px (3–4p)      EASE.overshoot
rotate  0 → u.x * 4deg     (it cants into the charge)
scale   1 → 1.05           SPRING.lift
z       → 400
+ attack ribbon on the FX canvas: 2px line attacker→defender nameplate,
  dash-offset animated over 260ms, then held at alpha .35
+ defender nameplate: SPRING.nudge scale [1,1.06,1], border → --color-rt-danger
```

**9 · Block intercept · 300 ms**
```
target = attackerC + (blockerC − attackerC) * 0.38 + perp * side * cw * 0.55
         → both cards stay fully visible
ease EASE.out, scale 1→1.02
+ 2px bracket on canvas linking blocker↔attacker, alpha .5
+ attacker "checked" recoil: 8px back toward origin, 120ms EASE.out
multi-block: blockers arc around the attacker at ±18° steps, radius cw * 0.8
```

**10 · Damage number punch · 480 ms · DOM, not canvas**
```
element positioned at target's top-right + (8, −6), aria-hidden="true"
t      0      .14    .26    1.00
scale  0.40   1.34   1.00   0.94         EASE.overshoot → EASE.out
opacity 0     1      1      0
y      0      −6     −10    −46
blur   3px    0      0      0            (only 2 of these may be live at once)
colour: damage → --color-rt-danger · life gain → --color-rt-ok
        commander damage → --color-rt-cmd + a "CMD" superscript
+ target card: brightness [1,1.5,1] 180ms  AND  x [0,−4,+3,0] 160ms EASE.out (damage ≥ 1)
+ FX: 18 sparks, cone away from the source direction
```
DOM (not canvas) for **all** FX text. That means the canvas never rasterizes a glyph, which structurally satisfies the workspace tofu rule — no `document.fonts.load()` race can ever bake tofu into a texture. State this in the code comment.

**11 · Death fade-drop · 440 ms + 300 ms flight**
```
on the real card:
t      0      .35                        1.00
scale  1      0.96                       0.82
opacity 1     0.85                       0
rotate 0      3deg                       8deg
filter  —     grayscale(.7) brightness(.7)  —
y      0      —                          +26px
pos ease EASE.in, opacity ease EASE.out
then flight → graveyard anchor, 300ms, arc 0.08, scale → 92/148 = 0.62
landing: pile top scaleY [1,.94,1] 160ms + count badge SPRING.nudge
FX: 10 dark motes drifting down, alpha .4, life 500ms
```

**12 · Life count** — MotionValue, **retargeting** (never restarts):
```
duration = clamp(320 + 22 * |delta|, 320, 900) ms,  ease EASE.out on the numeric value
changed digits: y [0,−6,0] SPRING.nudge · text colour → danger/ok for 260ms
life ≤ 5: the plate gains a 1.6s breathing pulse on a 2px ring
commander damage: matrix cell flashes --color-rt-cmd 320ms + SPRING.nudge on the number
retarget rule: 40→33 then 33→31 mid-flight does NOT restart — animate() to the new
  target carrying current velocity. This is exactly why life is a MotionValue, not state.
```

**13 · Token pop · 300 ms** (nothing to fly from): `scale [0.2, 1.12, 1]`, `opacity [0,1,1]`, `EASE.overshoot` + a 20-particle burst.
**14 · Reveal flip · 340 ms**: in-place `rotateY 180→0` + 24 px lift + return, `EASE.inOut`.
**15 · Generic zone→zone (Tier-3 default)**: `arc 0.14`, `380 ms`, `landing 'settle'`, `faceUpAtEnd = view.visible`. Every named beat above is a parameterisation of this.

### 4.6 The choreographer

```ts
// src/ui/anim/choreographer.ts
type Lane = 'card' | 'overlay' | 'hud';

interface Beat {
  id: string; seq: number; epoch: number;
  kind: BeatKind; lane: Lane;
  keys: string[];              // resources locked, e.g. ['card:abc','zone:bf:p2']
  durationMs: number;
  commitAt: 'start' | 'end';
  run(ctx: BeatCtx): Promise<void>;
}
interface Choreographer {
  ingest(events: EngineEvent[], viewAfter: PlayerView): void;   // the ONLY entry point
  applySnapshot(view: PlayerView): void;                        // hard sync, bumps epoch
  flush(): void;                                                // Esc: commit everything now
  setTimeScale(n: number): void;
  holdFastForward(on: boolean): void;
  stats(): { queuedGroups:number; pendingMs:number; rate:number;
             mode:'full'|'digest'|'drain'; epoch:number };
  reset(): void;
}
```

**Groups.** Events sharing an engine `stepId` form one `BeatGroup`. Groups run in order (LIFO stack resolution must be *visible* in order). Inside a group: beats with **disjoint `keys` run concurrently**, beats sharing a key **serialize**. Lane caps: `card` ≤ **6** concurrent flights (excess queued), `overlay` and `hud` unbounded — numbers and particles are cheap, and the HUD must never block.

**Lag model.** `ingest(events, viewAfter)` pushes `{groupId, view}` onto `pendingViews`. **A group's view is committed to `gameStore` when that group *starts*.** So state leads animation by at most one group's duration (~500 ms), never by the whole batch. `promptStore` is a **separate channel updated from the newest view immediately** — whose priority it is and what you're being asked can never lag. That's the design decision that keeps input responsive.

**Speed governor**, on `pendingMs = Σ queued durationMs`:

| pendingMs | rate | behaviour |
|---|---|---|
| ≤ 600 | 1.0 | full |
| 600–1800 | lerp 1.0 → 2.5 | full |
| > 1800 | 3.0 | full + **coalescing** |
| > 4000 **or** > 24 groups | — | **drain**: commit the newest view immediately, play only 120 ms zone-flash digests, then hard-sync |

**Coalescing rules (concrete):**
- n × `CardDrawn`, same player, same group → one staggered draw beat, `stagger = min(60, 420/n)`, total capped at 1200 ms.
- n × `PermanentTapped`, same row → one row-sweep beat.
- n × `LifeChanged`, same player → **retarget** the running counter; never queue two.
- n × `DamageDealt`, same target → sum into one punch.
- **A→B→C for the same card in one group → only the last hop flies.** Intermediates get a 90 ms pulse at their zone anchor if budget allows, else drop. This is a real case (cast → countered → graveyard) and without this rule you watch a card fly to the stack you already know it never stayed on.

**Failsafes — a dropped animation can never wedge the UI:**
1. Every `run()` is wrapped: `Promise.race([run(ctx), timeout(durationMs * 3 + 400)])`. On timeout → dev warn, force commit, force `inFlight.delete()`, continue.
2. Watchdog `setInterval(250)`: if `now − lastProgressAt > 2000` → drain mode.
3. The flight layer self-reaps any clone older than 3 s.
4. `epoch` guard: every beat records the epoch it was built in; a beat whose epoch ≠ current is discarded **before running**. One guard kills every async race across a reconnect.

**Reconnect / snapshot** — bypasses animation entirely:
```
applySnapshot(view):
  1. animQueue.reset(); flightLayer.cancelAll(); animStore.clear()
  2. gameStore.setState({ view, epoch: epoch + 1 })
  3. animStore.hardSyncFlash = true for 240ms (one global opacity 0→1 on the table)
     + a "Resynced" toast
```

**Convergence guarantee.** Two stores, one invariant:
> `animStore` may only **hide** or **decorate**. It never holds card→zone truth.

Therefore the DOM's zone membership is *always* the authoritative state, and the worst possible failure is a card being invisible for the flight duration. The reconciler (runs on every `animStore` change **and** on a 500 ms interval) clears any `inFlight` entry that has no live clone or is past its deadline. So **the visual layer lags the state layer by at most `max(beatTimeout) ≈ 2 s`, and always converges.**

The animation layer **is** allowed to lag — it must, so the hand re-fans instantly and clicks stay live. It is **not** allowed to gate input: `PromptBar` and all interaction read `gameStore`/`promptStore` and stay live mid-flight. Only exception: clicks on an `inFlight` card are ignored (it's invisible anyway); its actions remain reachable from the zone browser. Acting on a slightly-stale view is safe because **legality is checked host-side** — a rejected intent gets a 220 ms shake on the control that sent it.

**Interruption / skip / speed:**
- Setting `animationSpeed`: `Cinematic 1.0×` / `Brisk 1.4×` / `Fast 2.2×` / `Off (instant)` → a `timeScale` applied through `d(ms)` at beat construction.
- **Hold `Space`** → `timeScale = max(current, 4)` *and* every live `AnimationPlaybackControls.speed = 4`. Release restores. (This is why the flight layer is one MotionValue per clone — `speed` scales the whole flight in one assignment.)
- **`Esc`** → `flush()`: commit every queued/running beat, `complete()` all controls, clear `animStore`. One frame later everything is at rest in the authoritative pose.

**Digest mode** — three triggers, one implementation: `reducedMotion` ∥ `animationSpeed === 'off'` ∥ `!tableVisible` ∥ `drain`. No clones, no flights. Instead: a 140 ms opacity 0→1 plus a 2 px coloured outline pulse on the destination slot; life/damage change with a 1-frame crossfade. **The log gets the full narrative, so no information is lost.**

### 4.7 Event → beat mapping

| Event | Beats | Lane | Keys | Notes |
|---|---|---|---|---|
| `CardDrawn` | `draw` × n, stagger 60 | card | `card:*`, `zone:hand:p` | opponent → `faceMode:'back'`, dest = hand-count chip |
| `CardMoved` | generic `flight` | card | `card:*`, both zones | **the universal path** |
| `SpellCast` | `lift`(100) → `castFlight`(520) → `flourish`(360) | card+overlay | `card:*`, `zone:stack` | arrows drawn after arrival |
| `AbilityActivated` | source `pulse`(200) → `flourish` | card+overlay | | abilities are chits, not cards |
| `StackResolved` | `resolveFlight`(300) → landing | card | | remaining items slide up, stagger 40 |
| `PermanentTapped/Untapped` | `tap`(180) | card | `card:*` | coalesces to a row sweep |
| `PermanentEntered` | `thump` or `landDrop` | card | | usually the tail of a flight |
| `DamageDealt` | `damagePunch`(480) + shake | overlay | `card:target` | summed per target per group |
| `LifeChanged` | `lifeCount` (retargets) | hud | `life:p` | never queues |
| `CounterChanged` | `counterNudge`(220) | card | `card:*` | badge `scale [1,1.3,1]` |
| `AttackersDeclared` | `attackLunge` × n, stagger 50 | card | | |
| `BlockersDeclared` | `blockSlide` × n, stagger 40 | card | | |
| `CombatDamage` | **parallel** group of `damagePunch` | overlay | | combat damage IS simultaneous |
| `PhaseChanged` | `phaseAdvance`(200) | hud | `phase` | never blocks |
| `PriorityChanged` | `priorityMove`(180) | hud | `priority` | |
| `TokenCreated` | `tokenPop`(300) | card | | no flight — nothing to fly from |
| `CardRevealed` | `revealFlip`(340) | card | `card:*` | |
| `DiceRolled/CoinFlipped` | `diceRoll`(700) | overlay | | Tier-3 |
| `PlayerLost` | `seatDim`(600) | hud | | |

### 4.8 FX canvas layer

**Recommendation: Canvas2D + `requestAnimationFrame`. Not WebGL.** 1200 additive 4–10 px sprites at 1920×1080 on an RTX 3060 with Chromium's GPU-rasterized canvas is nowhere near a bottleneck; WebGL would add a context, shader compile, and a second GPU pool for zero perceptible gain while competing with the compositor for the same GPU. Reassess only if we ever want screen-space distortion (heat shimmer) — explicitly out of scope.

**Scope: particles and screen-space flashes only.** All per-card glow is CSS `box-shadow` / `filter: drop-shadow` **on the card element** — cheap, composited, and it travels with the flight clone automatically. All FX **text** is DOM. So one canvas suffices; no need for a below-cards canvas.

```
context: getContext('2d', { alpha: true, desynchronized: true })
sizing:  canvas.width = round(cssW * devicePixelRatio); ctx.setTransform(dpr,0,0,dpr,0,0) once
         ResizeObserver on the host, rAF-coalesced; re-read devicePixelRatio on every resize
         (Windows display scaling of 1.25/1.5 is common and changes at runtime)
pool:    MAX_PARTICLES 1200, preallocated SoA — 8 × Float32Array(1200) = 38.4 KB
         fields: x y vx vy life size hue alpha
loop:    parks itself (cancelAnimationFrame) when activeCount === 0; restarts on first emit
clear:   dirty-union clearRect when < 25% of the canvas is active, else full clear
batch:   one globalCompositeOperation='lighter' pass for all dots; no per-particle save/restore
```

Uses: cast burst + ring, thump dust, land flash, damage sparks, death motes, mana-tap sparks (6 particles from a tapped land toward the mana pool well), attack ribbons, block brackets, commander-damage violet flash.

### 4.9 Accessibility + performance

**Target: 60 fps (16.67 ms) with 40 permanents + 7 hand cards at 1920×1080, during a 6-card staggered draw plus a combat-damage volley.** Budget: React commit ≤ 4 ms, style+layout ≤ 4 ms, paint+composite ≤ 6 ms.

Discipline:
- Only `transform`, `opacity`, `filter` animate. **Never** `width/height/top/left/margin` in a beat.
- `filter: brightness/saturate` is composited on Chromium. `filter: blur` is not cheap — blur appears only in the damage number's 3-frame entrance, capped at 2 live elements.
- `will-change: transform` is added **only for a beat's duration**, via a class the choreographer toggles. A standing `will-change` on 40 cards = 40 composited layers and a GPU-memory blowout. Motion handles this for elements it animates; we only manage it for the CSS shimmer (`will-change: background-position`).
- `backface-visibility: hidden` on flight clones (needed for the flip anyway).
- **One rect-read phase per frame.** The choreographer is *forbidden* from calling `getBoundingClientRect` outside `rectRegistry.readAll`. Enforce with a dev-only monkeypatch in `perf.ts` that warns if it's called outside the read window.
- `contain: layout paint` on every band and card wrapper. `content-visibility: auto` on collapsed pods and off-screen log rows.
- The log windows past 200 rows (hand-rolled, no library).
- One `<img>` per card, `decoding="async"`, identical `src` across instances of the same printing → Chromium decodes once.
- Life/mana/phase/badge positions are MotionValues → they never re-render React.

Measurement — `src/ui/anim/perf.ts`, dev-only, `window.__rt.perf`:
- `perf.sample(seconds)` → rAF deltas → `p50/p95/p99`, `longFrames (>20ms)`, `dropped (>33ms)`.
- `PerformanceObserver({ type: 'long-animation-frame' })` — Chromium 123+, present in Electron 42/43. Gives per-long-frame script/style/layout attribution. This is the single best tool and it's built in.
- **Scenario harness** — the actual verification vehicle, because it bypasses pointer events entirely (per the workspace CDP warning): `window.__rt.scenario('stress40' | 'drawBurst' | 'combatVolley' | 'moveBurst' | 'lifeSwings' | 'combat4p' | 'stopsAudit')` injects synthetic views/events straight into `gameStore` and returns a perf report.
- **Gate: `p95 ≤ 18 ms` and `longFrames ≤ 2` over a 5 s stress run.** Escape hatches in priority order if it fails: (1) drop `filter` animations on opponent cards, (2) render opponent battlefields in `chit` mode, (3) particle cap 1200 → 400, (4) concurrent flight cap 6 → 3.

Accessibility:
- `<MotionConfig reducedMotion="user" nonce={CSP_NONCE}>` at the root handles declarative animations. The imperative flight layer checks `effectiveMotion` itself: `reducedMotion || speed==='off' || !tableVisible || drain ? 'digest' : 'full'`.
- Settings: `Animation speed` segmented (Cinematic/Brisk/Fast/Off) + `Follow system reduced-motion` (default on) + `Tap angle` + `Auto-stack identical permanents`.
- **Every animated state change has a non-motion signal too**: tapped = rotation **and** desaturation **and** a `⟳` glyph; summoning sickness = shimmer **and** a dashed ring **and** a tooltip; damage = a floating number **and** a persistent damage marker; priority = motion **and** a solid ring **and** PromptBar text.
- `aria-live="polite"` on the log's newest entry; `role="status"` on `PromptBar`. **Floating FX text is `aria-hidden="true"`** — the log is the accessible channel, and double-announcing damage is worse than not announcing it.
- Full keyboard path: `Tab` cycles zones, arrows move within a zone, `Enter` acts, `Space` = primary OK/pass, `Esc` = back, `1–9` = hand slots, `F` = zoom the focused card. Focus ring `2px --color-rt-accent` at `2px` offset (matching `mundifex/src/index.css:47-51`).

---

## 5. Card rendering

**Recommendation: hybrid — full Scryfall `png` (745×1040) as the face at every size, plus a thin "legibility chrome" layer rendered in CSS px.**

Why not either extreme: the full image alone is unreadable below ~190 px (the name is ~7 px tall at hand size) and its printed P/T is *wrong* the moment a +1/+1 counter lands. Re-drawing Arena-style frames means 15+ frame variants across sagas, classes, battles, levelers, prototypes, adventures — months of work to end up less faithful than the real card.

The chrome re-renders **only the four things you must read at a glance**, sized in CSS px so they don't scale with the image:
1. **Name strip** — top-anchored translucent bar, name at 11–12 px `font-display`, single line, ellipsized. Shown when `cardH < 190`, cross-fades out between 190–210 px where the printed name becomes legible.
2. **Cost pips** — top-right cluster, mana-font at 13 px. Always drawn in hand and on the stack; hidden on the battlefield (irrelevant there).
3. **P/T badge** — bottom-right, 22×15 px pill, 12 px tabular-nums, showing **current** P/T including counters and continuous effects. This alone justifies the chrome.
4. **Type icon** — a 12 px lucide glyph bottom-left, only in `chit` mode where the frame colour is no longer readable.

Everything else is chrome by definition: counters, tapped veil, damage markers, attachment stack, sickness, target rings, keyword chips.

**Four render modes off one `Card.tsx`:**
- `full` (H ≥ 120) — full png + chrome 1–3.
- `chit` (96 ≤ H < 120) — **`art_crop` fills the top 62 %** + a solid name strip + P/T + type icon. At 96 px the full card is mostly frame and border; the art crop shows strictly more information per pixel. Genuinely better than Arena at small sizes.
- `back` — our house card back.
- `pile` — top card in `chit` mode + count badge.

**Loading fallback chain (`useCardImage.ts`):**
1. Cache hit → a **custom `mtgimg://` protocol** registered in `electron/main.cjs` (`protocol.handle`). Recommended over `file://`: it dodges CSP pain, keeps the cache dir arbitrary, and lets us return 404 cleanly.
2. `art_crop` cached but `png` not → render `chit` immediately, upgrade to `full` on arrival with a 180 ms `EASE.out` crossfade.
3. Nothing cached → **`SyntheticFace`**: a colour-identity gradient + the name in `font-display` 13 px + cost pips + type line 10 px, all from the (tiny, always-local) oracle JSON, plus a 1.6 s shimmer. **Fully playable.** ⚠️ Never a blank rectangle, never a spinner on a card.
4. Download failed → the synthetic face persists + a 10 px `CloudOff` glyph + **one aggregated toast** ("42 card images unavailable — open Card Database to sync").

**Memory (respecting "never reduce resolution"):** always request `png`. But do **not** hold `ImageBitmap`s — 400 × 745 × 1040 × 4 B = 1.2 GB and the 3060 has 12 GB. Instead: `new Image()`, `await img.decode()`, drop the reference. The decoded frame stays in Chromium's own image cache and `<img>` reuse is instant, with Chromium managing eviction. Warm the 60 most-likely cards eagerly (commander, opening hand, everything on the battlefield), the rest at 4 concurrent decodes inside `requestIdleCallback`.

**Multi-face handling.** The view-model provides `faces: CardFaceView[]` + `activeFaceIndex`. `image_uris` lives on `card_faces[]` for transform/MDFC and on the root for split/adventure/flip.
- `FaceSwitcher` — a 20 px `RefreshCw` button at the card's bottom-left, on hover, for any card with `faces.length > 1` whose other face the player may see. Clicking is a **purely local peek** — it does not transform the permanent. Actual transformation is an engine event.
- Peek: `rotateY 0→180`, 340 ms `EASE.inOut`, both faces stacked with `backface-visibility: hidden`, `perspective: 1200px` on the wrapper. Engine-driven transform: same flip at 420 ms + a burst + `SPRING.thump` landing.
- **Split / aftermath / battle**: the printed png is the whole card with a sideways name. Offer a "rotate 90°" toggle **on the zoom panel only** — never rotate the table card, it breaks row packing.
- **Meld**: the zoom panel shows both halves side by side.

---

## 6. Interaction design for the automated shell

**Casting**
1. Click a hand card → `lift` beat + `PromptBar` shows the cost and `Cast` / `Cancel`.
2. **Auto-tap by default** (Arena's model): the client asks the host for a `costPlan`; the sources it would tap get a 2 px accent ring + a 0.6 s breathing pulse. `Enter` or `Cast` confirms. One extra click, total.
3. `Alt+click` the card, or the persistent `Manual mana` toggle → **manual mode**: click each source; the PromptBar fills in `{2}{G} · paid {1}{G}`; illegal sources drop to 40 % opacity and `pointer-events: none`.
4. **Targets: never a modal.** The PromptBar switches to `Choose target — creature an opponent controls (1 of 1)`. An **aim veil** (0.35 black) covers the table; legal targets are lifted above the veil with a pulsing 2 px ring and `scale 1.06` on hover; illegal targets stay under it and are non-interactive. Drag-to-target with a live bezier arrow is *also* supported, but click-click is primary. `Esc` backs out one step at a time.
5. Modals only for genuinely list-like choices: modes, X, scry/surveil ordering, "choose a card name" (`ChoiceModal`).

**Stack response window without tedium**
- Default policy = Arena's: auto-pass unless (a) I have a legal action **and** the step is in my `stops` set, or (b) something resolvable just hit the stack and I have a possible response, or (c) `Always stop` is on.
- `StopsPolicyPanel`: a `[my turn | others' turns] × [upkeep, draw, main1, begin combat, declare attackers, declare blockers, combat damage, end combat, main2, end step]` toggle grid, persisted. Defaults — my turn: main1, main2, declare attackers. Others' turns: declare attackers, declare blockers, end step.
- **Hold `Ctrl`** while the engine would auto-pass forces a stop (Arena's behaviour), hinted inline in the PhaseTrack.
- Stack display: newest on top, 132 px items at 26 px vertical offset; > 5 items compresses to 18 px and collapses the oldest behind a `+N` chit. Target arrows drawn only for the top 2 items (hover an item to see all of its arrows) — otherwise 4-player stacks become spaghetti.
- **No hard timer.** A 12 s soft ring on the PromptBar that only highlights, never auto-passes. Friends game (Decision 7).

**Declare attackers**
- **Click-select is primary.** Drag is a fallback. (The workspace CDP note that synthetic pointer events corrupt when the real mouse hovers the window is a *verification* constraint, but it also reflects that drags are fragile; click-select is testable and faster in practice.)
- Click a creature → half-lunge "armed" pose (22 px toward the default defender + a 2 px ring). Click again to unarm. `A` toggles all.
- **Multiplayer needs a defender choice, and this is where Arena gives no guidance.** Model: **pick the defender first, then arm creatures.** PromptBar: `Attacking: [Ana] [Ben] [Cy] · Split`. `Split` mode lets each armed creature take its own defender via right-click or a drag onto a pod. Default = all attack the same player, which covers the overwhelming majority of turns. (Decision 6.)
- Drag onto a pod is supported for defender assignment. Implement with pointer events + `setPointerCapture` and `preventDefault` on **mousedown** — the exact lesson from `cartapriscus` `Engine._setupInput` (Chromium autoscroll is a mousedown default that `pointerdown.preventDefault` does not stop).
- `Enter` / `Attack` confirms. `Esc` clears.

**Declare blockers**
- Click an attacker then its blockers, **or** a blocker then its attacker — whichever you click first becomes the anchor. The bracket link draws live. `Enter` confirms.
- Damage-assignment order for multi-blocks: a small inline reorder strip under the attacker, shown only when it matters.

**Tier-3 manual tools — where they live so they never intrude**
- A **drawer in the right rail** (`ManualToolsPanel`, wrench button or `Ctrl+M`). Never a floating palette over the table.
- Plus a **right-click context menu on every card** whose **last** section is `Manual…` with the 3 tools relevant to that card (move to zone, add/remove counter, tap/untap, reveal). Automated actions come first, separated by a divider and rendered in `text-rt-dim`.
- Every manual action writes a **distinctly styled log entry** (wrench glyph, `--color-rt-warn`) so the table can always see what was automated vs. hand-waved. In a friends game that's a trust feature, not a nicety.
- ⚠️ **Every text/number input is a real dialog** (`TextPromptDialog` / `NumberPromptDialog`). `window.prompt()` throws in Electron — this bit both cartapriscus and terrainscribe.
- Manual actions still go through the host engine as `ManualIntent` events on the append-only log, so they replicate and animate through the same choreographer. **No client-only mutations, ever.**

---

## 7. Visual direction

The strategy that keeps this tasteful: **the table is a deep desaturated blue-green so the five highly-saturated MTG colours read cleanly on top, and the UI accent is brass — deliberately not one of the five colours**, so an accent ring never looks like "red mana".

```css
/* src/index.css — plain @theme is correct here: every value is a literal at :root.
   ⚠️ If any token value ever becomes a var() onto a SCOPE-LOCAL variable, this block
   MUST become `@theme inline`, or every border-* utility silently falls back to
   currentColor (white lines everywhere). See cartapriscus/src/index.css:13-23. */
@theme {
  /* Neutrals — cool slate, faintly green-shifted: a card table under lamplight */
  --color-rt-void:      oklch(0.130 0.014 250);
  --color-rt-table:     oklch(0.245 0.021 195);
  --color-rt-table-lo:  oklch(0.195 0.019 195);
  --color-rt-surface:   oklch(0.205 0.014 250);
  --color-rt-raised:    oklch(0.250 0.015 250);
  --color-rt-inset:     oklch(0.160 0.012 250);
  --color-rt-border:    oklch(0.325 0.016 250);
  --color-rt-border-hi: oklch(0.430 0.020 250);
  --color-rt-text:      oklch(0.945 0.006 95);
  --color-rt-dim:       oklch(0.720 0.010 95);
  --color-rt-faint:     oklch(0.550 0.012 250);
  /* Accent — brass/amber. NOT one of the five colours, by design. */
  --color-rt-accent:    oklch(0.780 0.115 78);
  --color-rt-accent-hi: oklch(0.860 0.130 80);
  --color-rt-accent-lo: oklch(0.440 0.070 78);
  --color-rt-on-accent: oklch(0.190 0.020 78);
  /* Semantics */
  --color-rt-ok:        oklch(0.740 0.130 152);
  --color-rt-warn:      oklch(0.800 0.140 82);
  --color-rt-danger:    oklch(0.640 0.190 24);
  --color-rt-cmd:       oklch(0.660 0.190 300);   /* commander damage — unmistakable violet */
  /* The five colours, matched in LIGHTNESS so none dominates.
     That lightness matching is the whole "tasteful, not garish" lever. */
  --color-mtg-w:        oklch(0.930 0.045 92);    /* parchment, not pure white */
  --color-mtg-u:        oklch(0.680 0.135 245);
  --color-mtg-b:        oklch(0.460 0.055 300);   /* violet-black — visible on the felt */
  --color-mtg-r:        oklch(0.630 0.185 32);
  --color-mtg-g:        oklch(0.620 0.125 148);
  --color-mtg-c:        oklch(0.720 0.012 250);   /* colourless */
  --color-mtg-m:        oklch(0.780 0.115 85);    /* multicolour — gold */

  --font-display: 'Alegreya Variable', Georgia, serif;
  --font-sc:      'Alegreya SC', Georgia, serif;
  --font-ui:      'Inter Variable', system-ui, sans-serif;
  --font-rules:   'Crimson Pro Variable', Georgia, serif;
  --font-num:     'JetBrains Mono Variable', ui-monospace, monospace;
}
```

⚠️ **Resets go in `@layer base` only. Never an unlayered universal `*{margin:0;padding:0}`** — it silently zeroed 111 Tailwind spacing utilities twice in this workspace (`cartapriscus/AGENTS.md`, CSS scoping section).

**Where the five colours are allowed to appear — and nowhere else:**
1. Mana pips (mana-font, in their own colours).
2. A 2 px left-edge bar on stack items and log rows = the spell's colour identity.
3. The travelling glow on a flight clone.
4. The mana pool's 6 wells.
5. A thin gradient underline on each seat's nameplate = that player's commander's colour identity. **This is how you tell four pods apart at a glance** — quietly the most useful colour use in the app.

Card frames are the printed art's job. We never tint a card.

**Table surface — four stacked layers, zero image assets:**
1. `--color-rt-table` base.
2. Vignette: `radial-gradient(120% 90% at 50% 42%, transparent, oklch(0.13 0.014 250 / 0.55))`.
3. Noise: an inline 64×64 SVG `feTurbulence` data-URI, `background-repeat`, `opacity: .035`, `mix-blend-mode: overlay`. Static → zero cost.
4. Inlay ring: a 1 px `--color-rt-border` rounded rect at 62 % of the table area with `box-shadow: inset 0 0 60px oklch(0.13 0.014 250 / .35)` — gives the four pods something to sit *around*.

Each band gets a 1 px top border + a 12 px inner shadow so it reads as a physical mat.

**Typography — all local fontsource, no CDN:**

| Role | Package | Family |
|---|---|---|
| Display, card names, player names, headings | `@fontsource-variable/alegreya` | `Alegreya Variable` |
| Type lines, section labels | `@fontsource/alegreya-sc` | `Alegreya SC` |
| UI text | `@fontsource-variable/inter` | `Inter Variable` |
| Oracle/rules text (zoom panel) | `@fontsource-variable/crimson-pro` | `Crimson Pro Variable` |
| All numbers (life, P/T, counters, mana) | `@fontsource-variable/jetbrains-mono` + `font-variant-numeric: tabular-nums` | `JetBrains Mono Variable` |
| Mana symbols | `mana-font@^1.18.0` (SIL OFL 1.1) | `.ms .ms-g .ms-cost .ms-shadow` |
| Set symbols (deck list only, optional) | `keyrune@^3.19.0` | |

**Stated explicitly: MTG's Beleren is WotC-proprietary and is not on fontsource. Alegreya is the substitute** — a calligraphic humanist serif with slight stem flare, the closest widely-available open face to Beleren's character, and it has real small caps. Alternative if you want more "epic Roman": `@fontsource-variable/cinzel`, but it's caps-only — good for the wordmark, wrong for card names.

Fonts load via static `@import` in `index.css` (5 always-needed faces — no lazy import map is warranted here, unlike the ancient-script picker's ~70 historical fonts). ⚠️ **And since all FX text is DOM and the canvas never draws a glyph, the `document.fonts.load()`-before-rasterizing rule is satisfied structurally rather than by discipline.** Put that in a comment above `FxCanvas`.

Copy rule: never the words "magic"/"magical" as flavour. The proper noun "Magic: The Gathering" / "Commander" / "Magic card" is accurate and fine.

---

## 8. Build order

Each step ends with a concrete verification. Reminders that apply to every CDP step: **restart Vite before probing** (HMR ghost modules return a second zustand store instance and make assertions lie), launch with `npx electron . --dev --remote-debugging-port=9223 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`, and **assert on store-injected state, never synthetic pointer drags**.

**Step 0 — scaffold.** Copy `mundifex`'s shape: `vite.config.ts` (`base:'./'`, `assetsInlineLimit:0`, port **5280** `strictPort`, honour `process.env.PORT`), `electron/main.cjs` + `preload.cjs`, `electron:dev` / `desktop` / `electron:build` scripts, `scripts/dev-launcher.cjs` (reuse-or-start), NSIS + desktop shortcut + `electron-updater`. Deps: `react@^19.2`, `react-dom`, `zustand@^5.0.11`, **`motion@^12.42.2`**, `lucide-react@^1.21.0`, `tailwindcss@^4.2` + `@tailwindcss/vite`, the 5 font packages, `mana-font@^1.18.0`. Dev: `electron@^43.2.0`, `electron-builder@^26`, `vite@^8`, `@vitejs/plugin-react@^6`, `typescript@~5.9.3`. **Add `"overrides": { "@types/react": "^19.2.14", "@types/react-dom": "^19.2.3" }`** to pre-empt the known Motion/React-19 TS duplicate-types issue.
> **Verify:** `npx tsc -b` clean **with a scratch component using `motion.div` + `animate` + `whileHover` + a `ref`** (this is the specific thing that breaks with duplicate `@types/react`). `npm run dev` serves. `npm run electron:dev` opens a window. CDP: `Runtime.evaluate` `!!window.__rt`.

**Step 1 — tokens, shell, fonts.** `index.css` `@theme` block, resets in `@layer base`, `TitleBar`, `ScreenHost`, `uiStore`, `MotionConfig` with `nonce`, and a dev-only `#tokens` gallery screen.
> **Verify:** (a) the gallery renders every colour token and all 5 font stacks; assert `document.fonts.check('700 16px "Alegreya Variable"') === true` (a `false` here means a fallback is silently rendering). (b) **The 111-utility canary:** a `p-1…p-8` ladder; CDP-assert `getComputedStyle($('[data-probe=p4]')).padding === '16px'` and that all 8 rungs differ. (c) Mount one `motion.div` under the **production** CSP and assert zero `Content Security Policy` entries in the console — this is the `MotionConfig nonce` check.

**Step 2 — Card + image pipeline (static).** `Card.tsx` 4 modes, `useCardImage` 4-step fallback, `SyntheticFace`, the `mtgimg://` protocol handler, `CardZoomPanel`, `ManaCost`, `PowerToughness`.
> **Verify:** a `#cards` fixture screen renders 24 cards at H = 96/120/148/208/620 including an MDFC, a split, an adventure, a card with only `art_crop`, and one with nothing cached. Assert `window.__rt.cards.modeOf(id, h)` returns the expected mode at each size. Point the cache dir at an empty folder and assert every card falls to `SyntheticFace` with the name and cost still legible — **the offline/cold-start path must be provably playable.**

**Step 3 — rect registry + FlightLayer + `fly()`.** *(No engine, no table. Get this right before anything else animates.)*
> **Verify:** a `#flight` screen with two boxes. `await window.__rt.anim.fly({from:'a', to:'b', arc:.22, faceUpAtStart:false, durationMs:420})` — assert: (a) the promise resolves within 420 ± 80 ms; (b) `animStore.clones.length === 0` afterwards; (c) mid-flight `$('.rt-flight-clone')` exists and its computed `transform` matrix differs between two consecutive rAFs; (d) `cancel()` mid-flight **resolves** the promise and clears the clone; (e) `fly()` to an unregistered key still resolves, landing at the zone anchor (the arbitrary-zone failsafe).

**Step 4 — table metrics + seat layout (static).** `useTableMetrics`, pure `SeatLayout.ts`, `GameTable`, `TableSurface`, pods, bands, `packRow`, `PermanentStack`, `ZonePile`, static `HandFan`.
> **Verify (pure geometry — ideal for CDP).** `window.__rt.scenario('stress40')`, then loop **12 combinations** (1920×1080, 1600×900, 1280×800 × seatCount 2/3/4) asserting: every card's rect is inside its band's rect; no two cards in a battlefield row overlap (the `packRow` invariant); card heights equal the metric tokens; `document.documentElement.scrollHeight === innerHeight` (no scrollbar); every card height ≥ 96.

**Step 5 — HandFan interaction.** Hover lift, neighbours parting, hover intent, zoom trigger, `1–9` keys.
> **Verify (the pattern that dodges synthetic-pointer corruption):** `window.__rt.anim.setHoveredHandIndex(3)`, wait 250 ms, then read each card's computed transform and assert the x-offsets match `26 * exp(-|i-3| * 0.55)` within 0.5 px, the hovered card's `y === -54 ± 1`, and its `rotate === 0`. No pointer events involved.

**Step 6 — choreographer skeleton + digest mode.** Queue, groups, lanes, keys, governor, watchdog, epochs, `applySnapshot`, `flush`, hold-to-FF. Wire `CardMoved` → generic flight only.
> **Verify:** `window.__rt.scenario('moveBurst', {n:20})` in one tick. Assert: (a) final `gameStore` zone membership === the injected end state exactly; (b) `animStore.inFlight.size === 0` within 4 s; (c) `__rt.anim.stats()` shows `rate ≥ 2` then `mode === 'drain'`; (d) repeat, firing `applySnapshot` 200 ms in → assert `epoch` incremented, zero clones, state === snapshot, zero console errors; (e) `__rt.anim.injectHungBeat()` → the queue continues via the timeout and `stats().queuedGroups` returns to 0. **(e) is the anti-wedge proof — do not skip it.**

**Step 7 — the named beats.** draw, cast + flourish, resolve + thump, landDrop, tap, untapSweep, tokenPop, revealFlip, counterNudge, deathDrop.
> **Verify:** a `#beats` screen with a button per beat. `__rt.anim.record('draw')` samples the animated element's transform every rAF and returns the track. Assert endpoints match the spec **and that peak scale > settle scale** — i.e. the overshoot actually happened. That's a numeric assertion for "does it feel like Arena", which is otherwise unverifiable. Also assert `rotateY` crosses 90° within `t ∈ [0.45, 0.55]` for `draw` (the mid-flight flip).

**Step 8 — HUD.** `PlayerPlate`, `LifeCounter` (MotionValue, retargeting), `CommanderDamageMatrix`, `ManaPool`, `PhaseTrack`, `PriorityIndicator`, `GameLog`.
> **Verify:** `__rt.scenario('lifeSwings')` fires 40→33→31→45 at 80 ms gaps. Sample the MotionValue every rAF and assert it is **monotone toward each successive target and never returns to 40** (proves retarget, not restart); final text `45`. Assert commander-damage cells sum correctly and that a 21-total cell gets the lethal styling. Assert the log's newest row sits inside `[aria-live="polite"]`.

**Step 9 — FX canvas.** `FxCanvas`, SoA pool, emitters, rAF park/unpark, DPR handling.
> **Verify:** `__rt.fx.burst()` × 20 → assert `__rt.fx.stats().active <= 1200`; after 1.5 s assert `active === 0` **and `rafHandle === null`** (it parked — a canvas rAF that never sleeps is a 3 % permanent CPU tax). Resize to three sizes and assert `canvas.width === Math.round(cssW * devicePixelRatio)`; then CDP `Emulation.setDeviceMetricsOverride({deviceScaleFactor: 1.5})` and re-assert (Windows display scaling changes at runtime).

**Step 10 — combat.** Attack lunge, defender selection, block intercept, brackets, damage volley, lethal chains.
> **Verify:** `__rt.scenario('combat4p')` — 5 attackers across 2 defenders, 3 blockers, 2 lethal. Assert: every attacker's displacement has a positive dot product with the unit vector toward its assigned pod (it moved *toward* the right player); each blocker landed within 2 px of the computed intercept point; the 2 lethal creatures ended in the graveyard pile with `inFlight` clear and the pile count incremented by 2.

**Step 11 — PromptBar, casting, targeting, stops.** Cost plan, auto-tap review, manual mode, aim veil, target rings, response window, `StopsPolicyPanel`.
> **Verify:** `__rt.prompt.inject({kind:'chooseTargets', legal:[…]})` → assert **exactly** the legal ids have `data-legal="1"` and computed `pointer-events: auto`, and every other card computes `pointer-events: none`. `__rt.prompt.pick(id)` advances. Dispatch a real `keydown` for `Escape` on `document` (safe — keyboard events don't suffer the pointer-corruption problem) and assert it backs out exactly one step. `__rt.scenario('stopsAudit')` walks a full 4-player turn cycle and returns the steps where the UI stopped; assert it equals the configured set.

**Step 12 — Tier-3 tools.** `ManualToolsPanel`, `CardContextMenu`, dialogs, manual log styling.
> **Verify:** **grep `src/` for `window.prompt|window.confirm|window.alert` → must be zero hits.** (A real assertion for a real Electron footgun.) Then `__rt.tools.moveCard(id, 'exile')` → assert exactly one generic flight ran, the state moved, and the log entry carries `data-manual="1"` with the warn colour.

**Step 13 — reduced motion, speed, skip.** Wire `effectiveMotion`, the settings UI, hold-to-FF, `Esc`-flush, `tableVisible` digest.
> **Verify:** CDP `Emulation.setEmulatedMedia({features:[{name:'prefers-reduced-motion', value:'reduce'}]})` → `__rt.scenario('drawBurst')` → assert **zero clones were ever created**, state converged, total wall time < 400 ms. Set speed to `fast` → assert `__rt.anim.lastBeatDuration('draw') ≈ 420/2.2 ± 30 ms`. Navigate to `settings` mid-burst → assert digest mode engaged and state still converged (the desync trap).

**Step 14 — perf gate, then the non-table screens.**
> **Verify:** run the §4.9 gate — `p95 ≤ 18 ms`, `longFrames ≤ 2` over a 5 s `stress40` + `drawBurst` + `combatVolley` run, with the LoAF observer's attribution captured for any long frame. Then build Home / Profile / Decks / DeckEditor / DeckImport / CardDatabase / Lobby / Settings, verifying each with keyboard-only traversal and a visible focus ring on every control. Finally `npm run electron:build` → NSIS installer in `release/`, and confirm the packaged app boots from `file://` (the `base:'./'` check).

---

## 9. Decisions I need from the user

1. **App name + directory.** Drives the path, the `--rt-*` prefix, `window.__rt`, `appId`, and the port. Proposal: **`roundtable`** (four players, a round table), `--rt-*`, port **5280**.
2. **Card rendering.** Confirm the hybrid (full Scryfall `png` + our legibility chrome) over Arena-style hand-drawn frames. The hybrid is ~1 week; custom frames are months and end up *less* faithful.
3. **Auto-stack identical permanents** (12 Forests → one `Forest ×12` pile). **This is load-bearing** — without it a 4-player board does not fit at 1080p (5 slots per band). Recommend on by default with a settings toggle. It does change how the board reads.
4. **Default tap angle** — `20.5°` (tidy rows, my recommendation) or `90°` (paper-accurate, forces the row packer to reserve `max(w,h)` per slot). Offered as a setting either way; I need the default. — **ANSWERED 2026-07-27: `90°`, and not offered as a setting. See D75.**
5. **Card back art.** The real MTG card back is WotC IP. Options: (a) I design a neutral house back from our own tokens, (b) the user supplies an image. Needed before Step 2.
6. **Multiplayer declare-attackers model** — "pick one defender, then arm creatures" + a `Split` mode (my recommendation, fast, covers ~95 % of turns), vs. per-creature defender always visible.
7. **Response-window timer** — recommend none (a soft 12 s highlight that never auto-passes). Confirm.
8. **Heading font** — Alegreya (recommended, closest to Beleren's flavour) / Cinzel (caps-only, more Roman) / Inter for everything. **Beleren is unavailable — this substitution is unavoidable.**
9. **Opponent hand representation** — a fanned stack of card backs sized to the count (pretty, costs horizontal space) vs. one back + a count chip (compact). Recommend the chip at 3–4 players, the fan at 2.
10. **Does the table stay live while you're on another screen?** I've assumed yes, in digest mode. Confirm — the alternative (pausing) risks desync and needs a different reconnect story.

Out of scope but with hooks left in place: audio (each beat has a documented cue point), and per-card bespoke "cast flourish" effects like Arena's full-screen spell art — deliberately scoped to a glow + particle burst.

---

### Critical Files for Implementation

- `H:\Claude Apps\roundtable\src\ui\anim\choreographer.ts` — the event→animation bridge, queue, governor, epochs, convergence guarantee
- `H:\Claude Apps\roundtable\src\ui\anim\flightLayer.ts` + `H:\Claude Apps\roundtable\src\ui\anim\FlightLayer.tsx` — the portal flight mechanism (the hard part; Step 3 gates everything after it)
- `H:\Claude Apps\roundtable\src\ui\anim\tokens.ts` — DUR / EASE / SPRING / STAGGER + the `d(ms)` timeScale gate
- `H:\Claude Apps\roundtable\src\ui\table\useTableMetrics.ts` + `H:\Claude Apps\roundtable\src\ui\table\SeatLayout.ts` — the single source of layout truth for both CSS and the flight math
- `H:\Claude Apps\roundtable\src\index.css` — `@theme` OKLCH tokens, `@layer base` resets, font imports (the two documented Tailwind-4 footguns live here)

Reference files to read before writing any of it: `H:\Claude Apps\mundifex\src\index.css`, `H:\Claude Apps\mundifex\vite.config.ts`, `H:\Claude Apps\mundifex\package.json` (the stack template), `H:\Claude Apps\cartapriscus\src\index.css:13-23` (the `@theme inline` post-mortem), `H:\Claude Apps\cartapriscus\src\shell\theme.css:421-444` (the persistent-slot router pattern), `H:\Claude Apps\cartapriscus\src\stages\mapper\index.css:367-392` (the keyframe library to mirror), `H:\Claude Apps\cartapriscus\AGENTS.md` (CSS scoping + CDP verification lessons).

**Sources:** [motion npm](https://www.npmjs.com/package/motion) · [Motion layout animations](https://motion.dev/docs/react-layout-animations) · [Motion transitions](https://motion.dev/docs/react-transitions) · [Motion animate()](https://motion.dev/docs/animate) · [MotionConfig](https://motion.dev/docs/react-motion-config) · [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) · [Scryfall card imagery](https://scryfall.com/docs/api/images) · [Scryfall high-resolution PNGs](https://scryfall.com/blog/high-resolution-png-images-119) · [mana-font](https://github.com/andrewgioia/mana) · [motion React 19 TS discussion](https://github.com/motiondivision/motion/discussions/3375)

---Done---
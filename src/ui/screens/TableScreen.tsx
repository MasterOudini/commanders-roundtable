import { useCallback, useEffect, useRef, useState } from 'react';
import { GameTable } from '../table/GameTable';
import { FixtureTable } from '../../view/fixtures/table';
import { SCENARIOS, SCENARIOS_BY_ID } from '../../view/fixtures/scenarios';
import { FIXTURE_CARDS } from '../../data/fixtures/cards';
import type { CardData } from '../../data/cardTypes';
import { emptyView, type PlayerView } from '../../view/types';
import { useGame } from '../../store/gameStore';
import { useLayout } from '../../store/layoutStore';
import { useDrag } from '../../store/dragStore';
import { useHandHover } from '../../store/handStore';
import { useUi } from '../../store/uiStore';
import { readElements } from '../anim/rectRegistry';
import { decomposeTransform } from '../anim/record';
import { exposeDevHandles } from '../../devHandles';
import * as choreographer from '../anim/choreographer';
import { combatPlans } from '../anim/beats';
import { recentFlights } from '../anim/flightLayer';
import type { SeatCount } from '../table/metrics';
import { GameLayer } from '../game/GameLayer';
import { instanceIdOf } from '../game/AimVeil';
import { exposeEngineHandles } from '../game/devHandles';
import { exposeNetHandles } from '../../net/devHandles';
import { useTapKey } from '../game/useTapKey';
import { useEngineTable } from '../game/useEngineTable';
import { useTable } from '../../store/tableStore';
import * as session from '../../game/session';
import { BTN_GHOST_SMALL } from '../game/styles';

// The table screen. Always mounted (see App.tsx) and driven entirely by fixture
// scenarios in M2 — there is no rules engine yet, by design.
//
// ⚠️ M2 is deliberately built with NO engine so the MOTION can be judged before the
// rules exist. This workspace has two fully-built features that were reverted for
// looking wrong on real data; getting a reaction to the feel now is far cheaper
// than after M3. The scenarios drive the same `(events, viewAfter)` interface the
// engine will, so replacing the source changes nothing above it.

/** A spread of real cards, so the table shows real art rather than placeholders. */
const WANTED = [
  'Sol Ring', 'Forest', 'Island', 'Mountain', 'Swamp', 'Plains',
  'Lightning Bolt', 'Cultivate', 'Rampant Growth', 'Swords to Plowshares',
  'Kess, Dissident Mage', 'Birgi, God of Storytelling', 'Grave Titan',
  'Llanowar Elves', 'Serra Angel', 'Shivan Dragon', 'Wall of Omens',
  'Sakura-Tribe Elder', 'Solemn Simulacrum', 'Eternal Witness',
  'Arcane Signet', 'Command Tower', 'Lightning Greaves', 'Sword of Feast and Famine',
  'Rhystic Study', 'Smothering Tithe', 'Beast Within', 'Cyclonic Rift',
  'Chandra, Torch of Defiance', 'Delver of Secrets',
];

export function TableScreen() {
  const [seatCount, setSeatCount] = useState<SeatCount>(4);
  const [pool, setPool] = useState<CardData[]>(FIXTURE_CARDS);
  const [autoStack, setAutoStack] = useState(true);
  const [status, setStatus] = useState('Fixture cards (card database not loaded).');
  const [panelOpen, setPanelOpen] = useState(false);
  const view = useGame((s) => s.view);

  // ⚠️ THE M2↔M3 SWITCH. When a game is running the engine is the source of
  // views and events; otherwise the fixture scenarios are, exactly as in M2.
  // Nothing below this line in `src/ui/table/` or `src/ui/anim/` can tell the
  // difference — that is the seam, and keeping it is why the animation battery
  // still passes unchanged.
  const engineRunning = useTable((s) => s.running);
  // ⚠️ Handed over by whoever STARTED the game (the Play-solo screen, and the
  // lobby when it grows the same wiring) rather than owned here. While the table
  // owned them, only a game started from the table's own button ever had tokens
  // for the Tier-3 tools.
  const tokens = useTable((s) => s.tokens);
  const stops = useTable((s) => s.stops);
  const setGameSetup = useTable((s) => s.setGameSetup);
  const goto = useUi((s) => s.goto);
  const { onCardClick, onCardContextMenu, onCardPointerDown, onAttachmentsClick, onZoneClick, onCardDrop, dropCheck } = useEngineTable();
  // ⚠️ Point at a permanent and press E: it does what CLICKING it does. Wired
  // here rather than in `GameLayer` because this is where `onCardClick` lives,
  // and E must not become a second answer to what a card does.
  useTapKey(onCardClick);

  // ⚠️ Every dev handle reads through a ref. A handle that captured `table` or
  // `setSeatCount` from the render it was registered in would keep driving a dead
  // instance after HMR, and the probe would report "the table has no cards" —
  // indistinguishable from a render bug. This exact mistake has already cost a
  // debugging round in this project.
  const tableRef = useRef<FixtureTable | null>(null);
  const autoStackRef = useRef(autoStack);
  autoStackRef.current = autoStack;
  const poolRef = useRef(pool);
  poolRef.current = pool;

  // ⚠️ THE BOARD THAT WAS ASKED FOR — not the one that happens to be up. `setup()`
  // is a request, and the card pool resolves LATER (the visible-gated effect
  // below), so the rebuild that follows must reproduce THIS request with better
  // art rather than quietly substitute the component's defaults. Holding the whole
  // request and not just the seat count is the point: a rebuild that kept the
  // seats and reverted 10 permanents to 14 is the same lie in a smaller size. D74.
  const requestRef = useRef<{
    seatCount: SeatCount;
    permanentsPerSeat: number;
    handSize: number;
  }>({
    seatCount,
    // 14 each — a plausible mid-game Commander board, and enough for auto-stacking
    // to matter. The spec's "real board" figure is 21 each; the layout battery
    // stresses that number explicitly.
    permanentsPerSeat: 14,
    handSize: 7,
  });
  /** What the last build actually consumed, so an identical rebuild can be skipped. */
  const builtRef = useRef<{ seatCount: SeatCount; pool: CardData[] } | null>(null);

  // Pull real cards out of the index. Falls back to the hand-written fixtures, so
  // the table is developable with no card database at all.
  //
  // ⚠️ Gated on the table actually being VISIBLE, not on mount. The table screen is
  // always mounted (it must never unmount — see App.tsx), so fetching here on mount
  // fired a card-database request during app startup and forked the card-DB worker
  // before anything had asked for a card. That defeats the supervisor's lazy start,
  // which the shell probe asserts on: `worker is not started before the first
  // request` began failing with `state=ready`. An always-mounted screen must not do
  // work until it is actually looked at.
  const visible = useUi((u) => u.screen === 'table');
  const fetched = useRef(false);
  useEffect(() => {
    // ⚠️ …and not while a GAME is running. See the build effect below: the pool
    // arriving is what triggers a fixture rebuild, and a fixture rebuild during a
    // game overwrites the engine's view.
    if (!visible || fetched.current || engineRunning) return;
    const bridge = window.crt;
    if (!bridge) return;
    fetched.current = true;
    void bridge.cardDb
      .resolveNames(WANTED.map((name) => ({ name })))
      .then((results) => {
        const cards = results.map((r) => r.card).filter((c): c is CardData => c !== null);
        if (cards.length < 6) return;
        setPool(cards);
        setStatus(`${cards.length} real cards from the index.`);
        void bridge.images.prefetch(cards.map((c) => c.scryfallId));
      })
      .catch(() => {
        /* no database — fixtures are the fallback, and they are fully playable */
        fetched.current = false;
      });
  }, [visible, engineRunning]);

  /** Build exactly the board `requestRef` describes, from the pool we have now. */
  const build = useCallback(() => {
    const req = requestRef.current;
    const table = new FixtureTable({ seatCount: req.seatCount, pool: poolRef.current });
    const next = table.setup({
      permanentsPerSeat: req.permanentsPerSeat,
      handSize: req.handSize,
    });
    tableRef.current = table;
    builtRef.current = { seatCount: req.seatCount, pool: poolRef.current };
    // A fresh board is a HARD SYNC, not an animation: nothing moved, the world
    // simply is this now. applySnapshot also bumps the epoch, which discards any
    // beat still queued for the previous board — without that, a rebuild during a
    // burst would fly cards belonging to a table that no longer exists.
    choreographer.applySnapshot(next);
    return next;
  }, []);

  // Build once the pool is known, and rebuild when the seat count changes.
  //
  // ⚠️ The seat count in React STATE is the authority, because it is what the
  // metrics are solved for (`GameTable` → `useTableMetrics`), so `setup()` drives
  // it rather than working around it.
  //
  // ⚠️ And the skip is not an optimisation. `setup()` has already built this exact
  // board synchronously; rebuilding it here would fire a SECOND hard sync a tick
  // later, bumping the epoch and discarding whatever the caller queued in between.
  // Skipping only when the seats AND the pool are both unchanged means a real
  // change still rebuilds. D74.
  //
  // ⚠️ AND NEVER WHILE A GAME IS RUNNING. The fixture board and the engine both
  // commit into `useGame`, so a rebuild mid-game replaces the real table with a
  // fixture one — silently, because both are valid `PlayerView`s. This is
  // reachable by an ordinary route: the pool is fetched the first time the table
  // becomes VISIBLE, so starting a game anywhere else (the Play-solo screen, the
  // lobby since M4) and then looking at the table fetched the pool, changed
  // `pool`, and rebuilt on top of the live game. Measured: a 3-seat solo game
  // became a 4-seat fixture board between the start and the first frame.
  // The dependency on `engineRunning` also rebuilds the fixtures when a game
  // ENDS, which is the mode the table should return to. Same family as D74.
  useEffect(() => {
    requestRef.current = { ...requestRef.current, seatCount };
    if (engineRunning) return;
    const built = builtRef.current;
    if (built && built.seatCount === seatCount && built.pool === pool) return;
    build();
  }, [build, seatCount, pool, engineRunning]);

  // The engine's probe handles. Registered once, alongside the table's.
  useEffect(() => {
    exposeEngineHandles();
    exposeNetHandles();
  }, []);

  useEffect(() => {
    exposeDevHandles({
      layout: useLayout,
      game: useGame,
      table: {
        /**
         * Rebuild the board. Returns the committed view.
         *
         * ⚠️ This drives the React STATE, not only a ref. The seat count is an
         * input to the metrics solve, so a handle that moved the fixture board
         * alone laid N pods out inside a layout still solved for 4 — and the
         * battery's "2/3/4 seats" sweep never actually asked the solver about 2 or
         * 3 seats. The request is also REMEMBERED, so the card pool arriving later
         * rebuilds this board rather than the defaults. D74.
         *
         * ⚠️ Calling `setSeatCount` here is the one place a handle touches state
         * directly, and it is the exception the comment above warns about. It is
         * safe for exactly one reason: `build` is `useCallback(…, [])`, so this
         * effect re-registers every handle whenever the component instance
         * changes, and the setter captured here always belongs to the same
         * instance as the `build` beside it. Both go stale together or not at all.
         */
        setup: (opts: { seatCount?: SeatCount; permanentsPerSeat?: number; handSize?: number } = {}) => {
          requestRef.current = { ...requestRef.current, ...opts };
          if (opts.seatCount) setSeatCount(opts.seatCount);
          const v = build();
          return { seats: v.seatOrder.length, cards: Object.keys(v.cards).length };
        },
        seatCount: () => requestRef.current.seatCount,
        metrics: () => useLayout.getState().metrics,
        view: () => useGame.getState().view,
        scenarios: () => SCENARIOS.map((s) => ({ id: s.id, label: s.label, note: s.note })),

        /**
         * Run a scenario through the CHOREOGRAPHER, exactly as the engine will.
         *
         * `gapMs: 0` (the default for the burst scenarios) ingests every batch in
         * ONE tick, which is what exercises the speed governor, the coalescing
         * rules and drain mode. A positive gap is what a human watches.
         */
        run: async (id: string, opts?: { gapMs?: number; n?: number }) => {
          const table = tableRef.current;
          const def = SCENARIOS_BY_ID.get(id);
          if (!table || !def) return { ran: false, batches: 0, events: 0 };
          const batches = def.run(
            { table, pool: poolRef.current },
            opts?.n !== undefined ? { n: opts.n } : undefined,
          );
          const gap = opts?.gapMs ?? def.gapMs ?? 0;
          for (const batch of batches) {
            choreographer.ingest(batch.events, batch.view);
            if (gap > 0) await new Promise((r) => setTimeout(r, gap));
          }
          return {
            ran: true,
            batches: batches.length,
            events: batches.reduce((n, b) => n + b.events.length, 0),
            /** The end state the table MUST converge to. */
            expected: summarizeView(batches[batches.length - 1]?.view ?? useGame.getState().view),
          };
        },

        /**
         * Tap or untap named fixture cards, through the same batch path a
         * scenario uses.
         *
         * ⚠️ Exists because the auto-stack MERGE cannot be reproduced by any
         * canned scenario: whether an untapping pile keeps its slot or is absorbed
         * into another depends on which of its cards comes first in zone order, so
         * a battery that wants the absorbed case has to choose the card. It taps
         * nothing on its own and changes no rules — `FixtureTable.tap` is the same
         * method `tapAndUntap` calls.
         */
        tap: (instanceIds: string[]) => {
          const table = tableRef.current;
          if (!table) return { ok: false, events: 0 };
          const batch = table.tap(instanceIds);
          choreographer.ingest(batch.events, batch.view);
          return { ok: true, events: batch.events.length };
        },
        untapAll: (player?: string) => {
          const table = tableRef.current;
          if (!table) return { ok: false, events: 0 };
          const seat = player ?? useGame.getState().view.me;
          const batch = table.untapAll(seat);
          choreographer.ingest(batch.events, batch.view);
          return { ok: true, events: batch.events.length };
        },

        /** Zone membership + life, for an exact convergence assertion. */
        summary: () => summarizeView(useGame.getState().view),
        /** The plans the combat beats actually used — not a re-derivation. */
        combatPlans: () => combatPlans(),

        /** Wait until the queue is empty and nothing is hidden, or time out. */
        settle: async (timeoutMs = 8000) => {
          const started = performance.now();
          while (performance.now() - started < timeoutMs) {
            const s = choreographer.stats();
            if (s.queuedGroups === 0 && !s.running && s.liveBeats === 0 && s.inFlight === 0) {
              return { settled: true, ms: Math.round(performance.now() - started), stats: s };
            }
            await new Promise((r) => setTimeout(r, 50));
          }
          return {
            settled: false,
            ms: Math.round(performance.now() - started),
            stats: choreographer.stats(),
          };
        },

        anim: {
          stats: () => choreographer.stats(),
          flush: () => choreographer.flush(),
          holdFastForward: (on: boolean) => choreographer.holdFastForward(on),
          injectHungBeat: (on = true) => choreographer.injectHungBeat(on),
          reset: () => choreographer.reset(),
          snapshotNow: () => {
            const table = tableRef.current;
            if (!table) return { epoch: choreographer.currentEpoch() };
            choreographer.applySnapshot(table.view());
            return { epoch: choreographer.currentEpoch() };
          },
          domClones: () => document.querySelectorAll('[data-flight-clone]').length,
          combatPlans: () => combatPlans(),
          inFlight: () => choreographer.inFlightIds(),
          /** Where the last few flights actually started. See `recentFlights`. */
          flights: () => recentFlights(),
        },

        /**
         * Drag a card out of the hand, one step at a time. The BATTERY's only way
         * in, and the only reason it exists.
         *
         * ⚠️ It dispatches real PointerEvents, which AGENTS.md warns against —
         * and the warning is dodged rather than ignored. The trap is that genuine
         * and synthetic pointermoves INTERLEAVE and corrupt each other's gesture.
         * `useHandDrag` accepts only events whose `pointerId` matches the press it
         * started, and no real pointing device is ever id 787: a real mouse moving
         * over the window is ignored by this gesture, and this gesture is ignored
         * by anything the real mouse starts. The failure mode the rule exists to
         * prevent is structurally absent.
         *
         * Everything from React's own `onPointerDown` binding down to the engine's
         * intent is the shipped path — nothing here reimplements the gesture.
         */
        drag: dragHandles,

        devPanel: (open: boolean) => setPanelOpen(open),
        /** Toggling this off is how the battery PROVES auto-stacking is load-bearing. */
        setAutoStack: (on: boolean) => setAutoStack(on),
        autoStack: () => autoStackRef.current,
        setHovered: (index: number | null) => useHandHover.getState().setHovered(index),
        hovered: () => useHandHover.getState().hovered,

        /**
         * Hand slot poses, DECOMPOSED from the resolved transform matrix.
         *
         * ⚠️ This, not client rects, is how the fan geometry must be asserted. Fan
         * cards are rotated up to 15° and the hovered one straightens to 0°, so a
         * client rect's `left` changes for two reasons at once — the translation we
         * care about, and the rotated bounding box shrinking. Decomposing gives the
         * exact x/y/rotate/scale that was actually applied.
         */
        handPoses: () =>
          [...document.querySelectorAll('[data-hand-slot]')].map((el) => ({
            index: Number(el.getAttribute('data-hand-slot')),
            id: el.getAttribute('data-hand-instance'),
            ...decomposeTransform(getComputedStyle(el).transform),
          })),

        /**
         * Full rendered geometry, for the layout battery.
         *
         * ⚠️ Reads every rect through rectRegistry.readElements so the whole sweep
         * is ONE layout flush with no interleaved writes.
         *
         * ⚠️ AND: card SIZE is reported as `offsetWidth/offsetHeight` (the layout
         * box), never from the client rect. A tapped card is turned a full quarter
         * turn, so its client rect is the card standing on its side — a 101×141
         * card measures 141 px wide — and an assertion about card SIZE that read
         * the client rect would call that a broken aspect ratio. The layout box is
         * the card's own size whichever way it is facing.
         *
         * For the space a card OCCUPIES, use `slot` instead: the slot wrapper is
         * never itself rotated and is sized to the real footprint (`h × w` when
         * tapped), which is what the packer reserved and therefore the only honest
         * input to a no-overlap check. `rotated` says which case you are in. The
         * same trap is documented in CardFixtureScreen for the same reason.
         */
        geometry: () => {
          const bandEls = [...document.querySelectorAll('[data-band]')];
          const bandRects = readElements(bandEls);
          const bands = bandEls.map((bandEl, i) => {
            const slots = [...bandEl.querySelectorAll('[data-band-slot]')];
            const cardEls = slots.map((s) => s.querySelector('[data-card-id]'));
            // ⚠️ The TURN element, not the card root. The tap lives on
            // `[data-card-turn]` so that beats and the turn never write the same
            // element's transform (see the note in `Card`), which means the root's
            // border box stays upright even for a tapped card — its rect would
            // report the card standing up when it is lying flat.
            const turnEls = slots.map(
              (s) => s.querySelector('[data-card-turn]') ?? s.querySelector('[data-card-id]'),
            );
            // The slot wrapper is never rotated, so its rect IS the layout box.
            const slotRects = readElements(slots);
            const cardRects = readElements(turnEls);
            return {
              band: bandEl.getAttribute('data-band'),
              scrolls: bandEl.getAttribute('data-band-scrolls') === '1',
              rect: bandRects[i],
              cards: slots.map((s, j) => {
                const cardEl = cardEls[j] as HTMLElement | null;
                const turnEl = turnEls[j] as HTMLElement | null;
                return {
                  id: s.getAttribute('data-band-slot'),
                  count: Number(s.getAttribute('data-stack-count') ?? 1),
                  slot: slotRects[j],
                  layout: cardEl
                    ? { w: cardEl.offsetWidth, h: cardEl.offsetHeight }
                    : null,
                  // The turn element says so itself, so a beat mid-flight on the
                  // root cannot be mistaken for a tapped card.
                  rotated: turnEl?.getAttribute('data-card-turn') === '1',
                  /** On-screen extents, rotation included. Not for overlap checks. */
                  card: cardRects[j],
                };
              }),
            };
          });

          const handEls = [...document.querySelectorAll('[data-hand-slot]')];
          const handRects = readElements(handEls);
          const hand = handEls.map((el, i) => ({
            index: Number(el.getAttribute('data-hand-slot')),
            id: el.getAttribute('data-hand-instance'),
            rect: handRects[i],
            layout: { w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight },
            transform: getComputedStyle(el).transform,
          }));

          const pileEls = [...document.querySelectorAll('[data-zone]')];
          const pileRects = readElements(pileEls);
          const zones = pileEls.map((el, i) => ({
            zone: el.getAttribute('data-zone'),
            count: Number(el.getAttribute('data-zone-count') ?? 0),
            rect: pileRects[i],
          }));

          return {
            bands,
            hand,
            zones,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            scroll: {
              docH: document.documentElement.scrollHeight,
              docW: document.documentElement.scrollWidth,
              innerH: window.innerHeight,
              innerW: window.innerWidth,
            },
          };
        },
      },
    });
  }, [build]);

  return (
    <div
      className="relative h-full w-full"
      onContextMenu={(e) => {
        if (!engineRunning) return;
        // ⚠️ The SLOT wrappers carry the instance id; `data-card-id` is the
        // printing id and two copies of a card share it.
        const el = (e.target as HTMLElement).closest('[data-band-slot], [data-hand-slot]');
        const id = instanceIdOf(el);
        if (!id) return;
        e.preventDefault();
        onCardContextMenu(id, e.clientX, e.clientY);
      }}
    >
      <GameTable
        view={view ?? emptyView()}
        seatCount={engineRunning ? (Math.min(4, Math.max(2, view.seatOrder.length || 4)) as SeatCount) : seatCount}
        autoStack={autoStack}
        {...(engineRunning ? { onCardClick, onCardDrop, dropCheck, onCardPointerDown, onAttachmentsClick, onZoneClick } : {})}
        // ⚠️ In the BAR, not floating over it. Both of these used to sit at
        // `left-1/2 top-2`, which is the middle of the phase track — the button
        // covered two steps, and one of them was the current one often enough to
        // matter.
        // ⚠️ The seat count and the decks are chosen on the Play-solo screen, not
        // here. Two hardcoded buttons used to start 4- and 2-seat games with
        // starter decks at every seat, which is not a game anyone wanted to play
        // twice.
        phaseTrackRight={
          engineRunning ? (
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-end-game=""
              onClick={() => {
                session.stop();
                setGameSetup({ tokens: [], stops: null });
              }}
            >
              End game
            </button>
          ) : (
            <button
              type="button"
              className={BTN_GHOST_SMALL}
              data-start-solo=""
              onClick={() => goto('solo')}
            >
              Set up a solo game
            </button>
          )
        }
      />

      <GameLayer tokens={tokens} stops={stops} />

      {/* Dev controls. Not part of the shipped table — M3 replaces them with the
          real lobby and PromptBar.
          ⚠️ COLLAPSED BY DEFAULT. Expanded it covers the leftmost opponent pod
          entirely, which made the first screenshot of the table useless for judging
          the layout: three pods and a hidden one. A panel that obscures the thing
          it exists to exercise is worse than no panel.
          ⚠️ `top-[92px]` clears the two-row phase bar (48) AND the leftmost
          opponent's NAMEPLATE (56–86) beneath it, landing on empty felt. It sat
          at `top-9` while the bar was 30 px tall; both of the obvious
          replacements are worse — on the bar it covers a step, and at the top of
          the pod it covers that player's name, which is the one thing on a plate
          you cannot work out from anything else. */}
      {import.meta.env.DEV && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          data-dev-panel-toggle=""
          className="absolute left-2 top-[92px] z-[950] rounded border border-crt-border bg-crt-void/85 px-1.5 py-0.5 text-[10px] text-crt-faint hover:text-crt-text"
        >
          dev
        </button>
      )}
      {import.meta.env.DEV && panelOpen && (
        <div
          className="absolute left-2 top-[92px] z-[950] flex max-w-[240px] flex-col gap-1.5 rounded border border-crt-border bg-crt-void/92 p-2 text-[11px]"
          data-dev-panel=""
        >
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="self-end text-[10px] text-crt-faint hover:text-crt-text"
          >
            hide ✕
          </button>
          <div className="flex items-center gap-1">
            <span className="font-sc text-[9px] tracking-wider text-crt-faint">SEATS</span>
            {([2, 3, 4] as SeatCount[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeatCount(n)}
                className={`crt-num rounded px-1.5 ${
                  seatCount === n ? 'bg-crt-accent text-crt-on-accent' : 'text-crt-dim hover:text-crt-text'
                }`}
              >
                {n}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1 text-crt-dim">
              <input
                type="checkbox"
                checked={autoStack}
                onChange={(e) => setAutoStack(e.target.checked)}
              />
              stack
            </label>
          </div>
          <p className="text-crt-faint">{status}</p>
          <div className="flex max-h-[42vh] flex-col gap-0.5 overflow-y-auto">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.note}
                onClick={() => {
                  const table = tableRef.current;
                  if (!table) return;
                  void (async () => {
                    const batches = s.run({ table, pool: poolRef.current });
                    for (const batch of batches) {
                      choreographer.ingest(batch.events, batch.view);
                      if (s.gapMs) await new Promise((r) => setTimeout(r, s.gapMs));
                    }
                  })();
                }}
                className="rounded px-1.5 py-0.5 text-left text-crt-dim hover:bg-crt-raised hover:text-crt-text"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Synthetic drag, for the battery ──────────────────────────────────────────
//
// Module scope, not component state: the handles are registered once and must
// keep working across every re-render and every HMR remount, exactly like the
// rest of `exposeDevHandles`.

/** No real pointing device is ever this id. That is the whole safety argument. */
const PROBE_POINTER_ID = 787;
let probePoint = { x: 0, y: 0 };

function firePointer(type: string, x: number, y: number, node: EventTarget): void {
  probePoint = { x, y };
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: PROBE_POINTER_ID,
      pointerType: 'mouse',
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  );
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

const dragHandles = {
  /** Where the drop zone is, so a battery can also aim deliberately outside it. */
  zone: () => {
    const [r] = readElements([document.querySelector('[data-drop-zone="bf"]')]);
    return r ?? null;
  },
  state: () => dragSnapshot(),

  /** Press hand slot `index` and move just past the 6 px threshold. */
  start: async (index: number) => {
    const el = document.querySelector(`[data-hand-slot="${index}"]`);
    if (!el) return { ok: false, reason: `no hand slot ${index}` };
    const [from] = readElements([el]);
    if (!from) return { ok: false, reason: `hand slot ${index} has no box` };
    const x = from.left + from.width / 2;
    const y = from.top + from.height / 2;
    firePointer('pointerdown', x, y, el);
    firePointer('pointermove', x + 10, y - 10, window);
    await nextFrame();
    return { ok: true, state: dragSnapshot() };
  },

  /**
   * Press the top card of a draggable PILE — in practice my command zone — and
   * move just past the threshold. The same gesture `start` drives, from the
   * other place a card can be picked up.
   */
  startPile: async (zone = 'cmd:p1') => {
    const el = document.querySelector(`[data-pile-draggable="${zone}"]`);
    if (!el) return { ok: false, reason: `no draggable pile ${zone}` };
    const [from] = readElements([el]);
    if (!from) return { ok: false, reason: `pile ${zone} has no box` };
    const x = from.left + from.width / 2;
    const y = from.top + from.height / 2;
    firePointer('pointerdown', x, y, el);
    firePointer('pointermove', x + 10, y - 10, window);
    await nextFrame();
    return { ok: true, state: dragSnapshot() };
  },

  /** Move the held card to a point. */
  to: async (x: number, y: number) => {
    firePointer('pointermove', x, y, window);
    await nextFrame();
    return dragSnapshot();
  },

  /** Move the held card onto the middle of the drop zone. */
  toZone: async () => {
    const [zone] = readElements([document.querySelector('[data-drop-zone="bf"]')]);
    if (!zone) return { ok: false, reason: 'no drop zone on screen' };
    firePointer('pointermove', zone.left + zone.width / 2, zone.top + zone.height / 2, window);
    await nextFrame();
    return { ok: true, state: dragSnapshot() };
  },

  /** Let go where the card is now. */
  drop: async () => {
    firePointer('pointerup', probePoint.x, probePoint.y, window);
    await nextFrame();
    return dragSnapshot();
  },
};

/** The drag store, flattened to something a CDP assertion can read. */
function dragSnapshot(): {
  phase: string;
  instanceId: string | null;
  over: boolean;
  ok: boolean;
  hint: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  ghosts: number;
  podState: string | null;
  sourceHidden: boolean;
} {
  const s = useDrag.getState();
  return {
    phase: s.phase,
    instanceId: s.instanceId,
    over: s.over,
    ok: s.ok,
    hint: s.hint,
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    ghosts: document.querySelectorAll('[data-drag-layer]').length,
    podState:
      document.querySelector('[data-drop-zone="bf"]')?.getAttribute('data-drop-state') ?? null,
    /** Is the card's own slot in the fan painting nothing while it is held? */
    sourceHidden: s.instanceId
      ? document.querySelector(`[data-hand-instance="${s.instanceId}"] [data-in-flight="1"]`) !== null
      : false,
  };
}

/** Zone membership and life totals — the shape a convergence assertion compares. */
function summarizeView(view: PlayerView): {
  zones: Record<string, number>;
  life: Record<string, number>;
  cards: number;
  zoneOf: Record<string, string>;
} {
  const zones: Record<string, number> = {};
  for (const [zone, ids] of Object.entries(view.zones)) {
    if (ids && ids.length > 0) zones[zone] = ids.length;
  }
  const life: Record<string, number> = {};
  for (const [p, seat] of Object.entries(view.seats)) life[p] = seat.life;
  // Card → zone, so the assertion can be EXACT rather than a count that happens
  // to match while two cards swapped places.
  const zoneOf: Record<string, string> = {};
  for (const [zone, ids] of Object.entries(view.zones)) {
    for (const id of ids ?? []) zoneOf[id] = zone;
  }
  return { zones, life, cards: Object.keys(view.cards).length, zoneOf };
}

export type { PlayerView };

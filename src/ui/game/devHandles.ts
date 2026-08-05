// Dev handles for driving a real game from a CDP probe.
//
// ⚠️ Exposed from a module the app already loads, NOT imported by the probe.
// A probe that does `await import('/src/…')` gets a SECOND copy of every module
// after HMR — a ghost zustand store, a ghost session — and every assertion it
// then makes is about a game nobody is playing. That mistake has cost two full
// false-failure runs in this workspace; see AGENTS.md trap 1.
//
// ⚠️ Everything here reads through functions rather than closing over values.
// A handle that captured `session.current()` at registration time would keep
// reporting the state the app had when the screen first mounted.

import { exposeDevHandles } from '../../devHandles';
import * as session from '../../game/session';
import { startSolo } from '../../game/solo';
import { useTable } from '../../store/tableStore';
import { useGame } from '../../store/gameStore';
import { useAim } from '../../store/aimStore';
import { AIM_SLOP_PX, hitTest } from '../anim/arrowGeometry';
import { cardSlot, resolveKey } from '../anim/rectRegistry';
import * as choreographer from '../anim/choreographer';
import { clonesCreated } from '../anim/flightLayer';
import { prefersReducedMotion } from '../anim/reducedMotion';
import { animScale } from '../anim/tokens';
import { viewHash } from '../../engine/diffView';
import { hoverFrom, hoveredInstanceId } from './useTapKey';
import type { Intent } from '../../engine/types/intents';

export function exposeEngineHandles(): void {
  exposeDevHandles({
    engine: {
      /** Start a real solo game. Returns the status message and seat count. */
      start: async (seats = 4) => {
        const result = await startSolo({ seats, seed: `probe-${seats}` });
        return {
          ok: result.ok,
          message: result.message,
          seats: session.seatIds(),
          missing: result.missing.length,
        };
      },
      stop: () => {
        session.stop();
        return { running: session.isRunning() };
      },
      running: () => session.isRunning(),
      /** Everything a probe needs to decide what to do next. */
      state: () => {
        const snapshot = session.current();
        return {
          running: snapshot.running,
          viewer: snapshot.viewer,
          priority: snapshot.priority,
          awaiting: snapshot.awaiting,
          turn: snapshot.turn,
          finished: snapshot.finished,
          winners: snapshot.winners,
          legal: snapshot.legal.map((a) =>
            a.t === 'CastSpell'
              ? { t: a.t, card: a.card, label: a.label, affordable: a.affordable, tax: a.tax }
              : a.t === 'PlayLand'
                ? { t: a.t, card: a.card, label: a.label }
                : a.t === 'TapForMana'
                  ? {
                      t: a.t,
                      card: a.card,
                      label: a.label,
                      conditional: a.conditional,
                      // ⚠️ Both of these are what a probe needs to ask "what can
                      // this land bring, and which intent brings it". Leaving
                      // them out reported `outputs is not iterable`, which reads
                      // as an engine bug rather than as a handle projecting the
                      // action down to less than the app has.
                      abilityIndex: a.abilityIndex,
                      outputs: [...a.outputs],
                    }
                  : { t: a.t },
          ),
          events: session.eventCount(),
          logLength: session.logLength(),
          hash: session.stateHashNow(),
        };
      },
      /**
       * Send any intent. The probe drives the game exactly as a player would.
       *
       * ⚠️ `submit()` is fire and forget (see `session.ts`), so the answer is
       * read back rather than returned. Over a loopback — which is what solo
       * play and every probe use — the host has already answered by the time
       * this line runs, so the reading is exact. It would not be over a socket,
       * and a probe that needs that should wait on the snapshot instead.
       */
      submit: (intent: Intent) => {
        session.submit(intent);
        const rejection = session.lastRejection();
        return rejection ? { ok: false, ...rejection } : { ok: true };
      },
      setViewer: (player: string) => {
        session.setViewer(player);
        return session.current().viewer;
      },
      setAutoSwitch: (on: boolean) => {
        session.setAutoSwitch(on);
        return on;
      },
      preview: (card: string, x = 0) => session.previewCast(card, x),
      targets: () => session.targetables(),
      /** The parsed target clauses of a card — how a probe finds a targeted spell. */
      aimSpecs: (card: string, abilityIndex?: number) => [...session.targetSpecsFor(card, abilityIndex)],
      rewind: (eventCount: number) => session.rewindTo(eventCount),

      /** UI mode, so the probe can assert the aim veil and the prompt bar. */
      ui: () => {
        const t = useTable.getState();
        return {
          mode: t.mode,
          message: t.message,
          toolsOpen: t.toolsOpen,
          stopsOpen: t.stopsOpen,
          hasDialog: t.numberRequest !== null || t.textRequest !== null,
          cardMenu: t.cardMenu?.card ?? null,
        };
      },
      setMode: (mode: ReturnType<typeof useTable.getState>['mode']) => {
        useTable.getState().setMode(mode);
        return useTable.getState().mode.kind;
      },
      escape: () => {
        useTable.getState().escape();
        return useTable.getState().mode.kind;
      },

      /**
       * Aiming, driven through the SAME functions a real pointer drives.
       *
       * ⚠️ No synthetic `PointerEvent` anywhere — the workspace note about
       * synthetic drags corrupting when the real mouse is over the window is
       * exactly why. `moveTo` is the one writer the real `pointermove` handler
       * calls, so the battery exercises the production path minus the
       * interleaving, which is the argument `dragStore` already makes for itself.
       */
      aim: {
        /**
         * Start an aim the way a click does, from a real card id.
         *
         * ⚠️ Exists so the battery never hand-constructs a `TableMode`. It used
         * to, and when the mode gained fields the battery kept passing the old
         * shape — the veil then saw a malformed mode, the prompt bar threw, and
         * four unrelated checks failed while reporting a feature bug that was
         * really a shape mismatch.
         */
        begin: (card: string, abilityIndex?: number) => {
          const specs = session.targetSpecsFor(card, abilityIndex);
          const max = specs.reduce((n, s) => n + s.max, 0);
          if (specs.length === 0 || max === 0) return { ok: false, reason: 'no targets', specs: 0 };
          const min = specs.reduce((n, s) => n + s.min, 0);
          const source =
            abilityIndex === undefined
              ? ({ kind: 'spell', card } as const)
              : ({ kind: 'ability', card, abilityIndex } as const);
          const name = useGame.getState().view.cards[card]?.card?.name ?? card;
          useTable.getState().setMode({
            kind: 'targeting',
            source,
            name,
            chosen: [],
            specs,
            min,
            max,
            next: abilityIndex === undefined ? 'payment' : 'submit',
          });
          const rect = resolveKey(cardSlot(card));
          useAim.getState().begin({ sourceKey: cardSlot(card), sourceRect: rect, viaDrag: false });
          return { ok: true, specs: specs.length, min, max, legal: session.legalTargetsFor(specs, card).length };
        },
        /** What the aim currently looks like, straight off the stores. */
        state: () => {
          const a = useAim.getState();
          const m = useTable.getState().mode;
          return {
            phase: a.phase,
            snapKey: a.snapKey,
            x: a.x,
            y: a.y,
            anchors: a.anchors.length,
            legal: a.anchors.filter((n) => n.legal).length,
            chosen: m.kind === 'targeting' ? m.chosen : [],
            min: m.kind === 'targeting' ? m.min : 0,
            max: m.kind === 'targeting' ? m.max : 0,
            name: m.kind === 'targeting' ? m.name : null,
          };
        },
        /** Every anchor the veil measured, with its legality and rect. */
        anchors: () => useAim.getState().anchors.map((a) => ({ ...a })),
        /** Move the cursor to an arbitrary point, snapping as a real move would. */
        moveTo: (x: number, y: number) => {
          const s = useAim.getState();
          const legal = s.anchors.filter((a) => a.legal);
          s.moveTo(x, y, hitTest({ x, y }, legal, AIM_SLOP_PX) as never);
          return { snapKey: useAim.getState().snapKey };
        },
        /** Move onto a named anchor's centre, so the battery never does arithmetic. */
        over: (key: string) => {
          const hit = useAim.getState().anchors.find((a) => a.key === key);
          if (!hit) return { snapKey: null, found: false };
          const x = hit.rect.left + hit.rect.width / 2;
          const y = hit.rect.top + hit.rect.height / 2;
          useAim.getState().moveTo(x, y, hit.legal ? (key as never) : null);
          return { snapKey: useAim.getState().snapKey, found: true, legal: hit.legal };
        },
        /** The paths actually in the DOM — the arrow as painted, not as intended. */
        paths: () => ({
          live: document.querySelector('[data-aim-arrow]')?.getAttribute('d') ?? null,
          head: document.querySelector('[data-aim-head]')?.getAttribute('transform') ?? null,
          committed: [...document.querySelectorAll('[data-committed-arrow] path')].map((p) =>
            p.getAttribute('d'),
          ),
          persistent: [...document.querySelectorAll('[data-stack-arrow]')].map((p) => p.getAttribute('d')),
        }),
      },

      /**
       * The E shortcut: what the pointer is over, and how to put it there.
       *
       * ⚠️ `hover` goes through `hoverFrom`, the same writer the real
       * `pointerover` listener calls — the aim handles' reason, unchanged: a
       * synthetic pointer event racing the real mouse is a corruption this
       * workspace has already paid for. The KEYPRESS is left to the battery to
       * dispatch for real, because a keyboard event has no such hazard and
       * dispatching it is what proves the key is actually bound.
       */
      tap: {
        hover: (selector: string) => hoverFrom(document.querySelector(selector)),
        hovered: () => hoveredInstanceId(),
      },

      /** The projected view the table is currently rendering. */
      view: () => useGame.getState().view,
      /** Wait for the animation queue to drain, so geometry is stable. */
      settle: async (timeoutMs = 8000) => {
        const started = performance.now();
        while (performance.now() - started < timeoutMs) {
          const s = choreographer.stats();
          if (s.queuedGroups === 0 && !s.running && s.liveBeats === 0 && s.inFlight === 0) {
            return { settled: true, ms: Math.round(performance.now() - started) };
          }
          await new Promise((r) => setTimeout(r, 40));
        }
        return { settled: false, ms: Math.round(performance.now() - started) };
      },

      /**
       * Play the game forward automatically: answer prompts with the simplest
       * legal answer and pass priority. Returns what it did, so a probe can
       * assert the game actually moved rather than that nothing threw.
       */
      autoplay: async (maxSteps = 400) => {
        let steps = 0;
        let rejected = 0;
        const startTurn = session.current().turn.number;
        session.setAutoSwitch(false);
        for (let i = 0; i < maxSteps; i++) {
          const snapshot = session.current();
          if (!snapshot.running || snapshot.finished) break;
          const intent = simplestIntent(snapshot);
          if (!intent) break;
          session.submit(intent);
          const rejection = session.lastRejection();
          if (rejection) rejected++;
          else steps++;
          if (rejection) break;
        }
        session.setAutoSwitch(true);
        const end = session.current();
        return {
          steps,
          rejected,
          fromTurn: startTurn,
          toTurn: end.turn.number,
          finished: end.finished,
          winners: end.winners,
        };
      },
    },

    // ── M5: what the motion battery measures ─────────────────────────────────
    //
    // ⚠️ `clonesCreated` is CUMULATIVE, not a live count. The reduced-motion gate
    // has to prove nothing flew across a whole game, and a clone that mounted and
    // unmounted between two polls is invisible to `activeFlights`.
    //
    // ⚠️ `viewHash` is taken over the COMMITTED view — the one the choreographer
    // wrote to gameStore — not over the session snapshot. That is the difference
    // between "the engine kept running" and "the table kept being told about it",
    // and digest mode is precisely where the second could silently stop while the
    // first carried on. A choreographer that PAUSED instead of digesting would
    // leave this hash frozen while the engine advanced, and after M4 that means
    // diverging from three other people.
    motion: {
      clonesCreated: () => clonesCreated(),
      viewHash: () => viewHash(useGame.getState().view),
      reducedMotion: () => prefersReducedMotion(),
      /** The scale `d(ms)` is currently dividing by. Infinity = instant. */
      scale: () => animScale(),
      stats: () => choreographer.stats(),
      busy: () => choreographer.isBusy(),
      /** Esc: commit everything queued now, at its final pose. */
      flush: () => {
        choreographer.flush();
        return choreographer.stats();
      },
      holdFastForward: (on: boolean) => {
        choreographer.holdFastForward(on);
        return animScale();
      },
    },
  });
}

/** The simplest legal answer to whatever the game is waiting for. */
function simplestIntent(snapshot: session.SessionSnapshot): Intent | null {
  const awaiting = snapshot.awaiting;
  if (awaiting) {
    switch (awaiting.kind) {
      case 'mulligan': {
        const player = awaiting.players[0];
        return player ? { t: 'MulliganDecision', player, keep: true } : null;
      }
      case 'mulliganBottom':
        return null;
      case 'declareAttackers':
        return { t: 'DeclareAttackers', player: awaiting.player, attackers: [] };
      case 'declareBlockers': {
        const player = awaiting.players.find((p) => !awaiting.submitted.includes(p));
        return player ? { t: 'DeclareBlockers', player, blocks: [] } : null;
      }
      case 'chooseLegendKeep': {
        const keep = awaiting.candidates[0];
        return keep ? { t: 'ChooseLegendKeep', player: awaiting.player, keep } : null;
      }
      case 'commanderZoneChoice':
        return { t: 'CommanderZoneChoice', player: awaiting.player, toCommandZone: true, always: true };
      case 'orderTriggers':
        return { t: 'OrderTriggers', player: awaiting.player, order: [...awaiting.triggers] };
      case 'optionalTrigger':
        return {
          t: 'AnswerOptionalTrigger',
          player: awaiting.player,
          stackId: awaiting.stackId,
          accept: false,
        };
      default:
        return null;
    }
  }
  const holder = snapshot.priority;
  return holder ? { t: 'PassPriority', player: holder } : null;
}

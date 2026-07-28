import { useEffect, useRef, useState } from 'react';
import { FIXTURE_CARDS } from '../../data/fixtures/cards';
import type { CardData } from '../../data/cardTypes';
import { exposeDevHandles } from '../../devHandles';
import {
  activeCount,
  cancel,
  cancelAll,
  currentEpoch,
  fly,
  setEpoch,
  setSpeed,
} from '../anim/flightLayer';
import { recordElement, summarize } from '../anim/record';
import { register, resolve, zoneSlot, type SlotKey } from '../anim/rectRegistry';
import { Card } from '../card/Card';
import type { ZoneId } from '../../view/types';

// Dev screen (#flight). The flight layer ALONE, on two boxes, with no table, no
// choreographer and no engine.
//
// This screen exists because step 2 gates every step after it. If `fly()` is
// wrong — off by a frame, leaking clones, resolving early, failing to resolve at
// all — then every beat built on top of it is wrong in a way that looks like a
// beat bug. Getting a promise contract and a landing pixel verified here, in
// isolation, is worth a whole screen.

/** Two real zones, so the registry is exercised through its real key shape. */
const BOX_A: ZoneId = 'lib:p1';
const BOX_B: ZoneId = 'hand:p1';
/** Deliberately never rendered — the arbitrary-zone failsafe. */
const BOX_MISSING: ZoneId = 'exile:p9';

type BoxName = 'a' | 'b' | 'missing';
const ZONE_FOR: Record<BoxName, ZoneId> = { a: BOX_A, b: BOX_B, missing: BOX_MISSING };

interface FlyOptions {
  from?: BoxName;
  to?: BoxName;
  durationMs?: number;
  arc?: number;
  faceUpAtStart?: boolean;
  faceUpAtEnd?: boolean;
  /** Fly to a card slot that does not exist, falling through to the zone anchor. */
  viaMissingCard?: boolean;
}

interface FlightTestApi {
  fly: (opts?: FlyOptions) => Promise<unknown>;
  flyAndCancel: (atMs?: number, durationMs?: number) => Promise<unknown>;
  flyMany: (n?: number, durationMs?: number) => Promise<unknown>;
}

export function FlightTestScreen() {
  const [log, setLog] = useState<string[]>([]);
  const card: CardData = FIXTURE_CARDS[0]!;
  const cardRef = useRef(card);
  cardRef.current = card;

  const say = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${line}`, ...l].slice(0, 12));
  const sayRef = useRef(say);
  sayRef.current = say;

  // The buttons call through this ref, so they drive the SAME functions the probe
  // does rather than a parallel code path. A test screen whose buttons and whose
  // probe API disagree is a screen that proves nothing.
  const api = useRef<FlightTestApi | null>(null);

  useEffect(() => {
    let seq = 0;

    /** One flight, timed, with the whole report a probe needs. */
    const flyOnce = async (opts: FlyOptions = {}) => {
      const from = opts.from ?? 'a';
      const to = opts.to ?? 'b';
      const durationMs = opts.durationMs ?? 420;
      const id = `test-${++seq}`;

      // The source rect is read BEFORE anything else, exactly as the
      // choreographer does it: the real protocol is commit-then-fly, and reading
      // late is the bug this ordering exists to prevent.
      const fromRect = resolve(null, ZONE_FOR[from]);

      const started = performance.now();
      const promise = fly({
        instanceId: id,
        epoch: currentEpoch(),
        from: fromRect,
        to: opts.viaMissingCard
          ? // A card slot that was never registered. resolve() falls through
            // card → zone anchor → viewport centre, so this must still land.
            (`card:${id}-nowhere` as SlotKey)
          : zoneSlot(ZONE_FOR[to]),
        card: cardRef.current,
        faceUpAtStart: opts.faceUpAtStart ?? false,
        faceUpAtEnd: opts.faceUpAtEnd ?? true,
        arc: opts.arc ?? 0.22,
        durationMs,
        ease: 'flight',
        peakScale: 1.14,
        glow: 'oklch(0.78 0.115 78 / 0.5)',
      });

      await promise;
      const elapsed = performance.now() - started;
      const report = {
        id,
        requestedMs: durationMs,
        elapsedMs: Math.round(elapsed),
        withinTolerance: Math.abs(elapsed - durationMs) <= 80,
        activeAfter: activeCount(),
        domClonesAfter: document.querySelectorAll('[data-flight-clone]').length,
        landedAt: (() => {
          const r = resolve(null, ZONE_FOR[to]);
          return { left: Math.round(r.left), top: Math.round(r.top) };
        })(),
      };
      sayRef.current(
        `${id}: ${report.elapsedMs}ms (asked ${durationMs}) · clones after ${report.domClonesAfter}`,
      );
      return report;
    };

    /** Start a flight and cancel it partway. Must still resolve. */
    const flyAndCancel = async (atMs = 150, durationMs = 600) => {
      const id = `cancel-${++seq}`;
      const fromRect = resolve(null, BOX_A);
      const started = performance.now();
      const p = fly({
        instanceId: id,
        epoch: currentEpoch(),
        from: fromRect,
        to: zoneSlot(BOX_B),
        card: cardRef.current,
        faceUpAtStart: false,
        faceUpAtEnd: true,
        arc: 0.22,
        durationMs,
      });
      await new Promise((r) => setTimeout(r, atMs));
      const cloneMidFlight = document.querySelectorAll('[data-flight-clone]').length;
      cancel(id);
      // If cancel() failed to resolve the promise this races the 3 s reaper, so
      // `resolvedMs` comes back at ~3000 and the assertion fails loudly instead
      // of the probe hanging.
      await p;
      const resolvedMs = performance.now() - started;
      sayRef.current(`${id}: cancelled at ${atMs}ms, resolved at ${Math.round(resolvedMs)}ms`);
      return {
        id,
        cloneMidFlight,
        resolvedMs: Math.round(resolvedMs),
        resolvedEarly: resolvedMs < durationMs - 50,
        activeAfter: activeCount(),
        domClonesAfter: document.querySelectorAll('[data-flight-clone]').length,
      };
    };

    /** Concurrent flights, to prove the layer handles more than one. */
    const flyMany = async (n = 4, durationMs = 380) => {
      const all = await Promise.all(
        Array.from({ length: n }, (_, i) => flyOnce({ durationMs, arc: 0.1 + i * 0.04 })),
      );
      return {
        n,
        allResolved: all.length === n,
        activeAfter: activeCount(),
        domClonesAfter: document.querySelectorAll('[data-flight-clone]').length,
      };
    };

    api.current = { fly: flyOnce, flyAndCancel, flyMany };

    // ⚠️ Every handle here calls a module function or reads through a ref. None
    // captures component state or a setter — a captured setter from a replaced HMR
    // instance silently does nothing, and the probe then reports a render bug that
    // does not exist.
    exposeDevHandles({
      anim: {
        fly: flyOnce,
        flyAndCancel,
        flyMany,

        /**
         * Fly and record the clone's real transform every frame.
         * `distinctMatrices > 2` is the proof that it MOVED rather than jumping.
         */
        flyAndRecord: async (opts: FlyOptions = {}) => {
          const durationMs = opts.durationMs ?? 420;
          const rec = recordElement('[data-flight-clone]', durationMs + 250);
          const report = await flyOnce(opts);
          const samples = await rec;
          // Normalise against the REQUESTED duration, not the recorded window —
          // see the note on `summarize`.
          return { report, track: summarize(samples, durationMs), samples: samples.length };
        },

        activeCount,
        domCloneCount: () => document.querySelectorAll('[data-flight-clone]').length,
        cancelAll,
        setSpeed,
        epoch: currentEpoch,
        setEpoch,
        /** Rects the registry currently resolves, for a landing assertion. */
        rects: () => ({
          a: resolve(null, BOX_A),
          b: resolve(null, BOX_B),
          missing: resolve(null, BOX_MISSING),
        }),
      },
    });
  }, []);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header>
        <h2 className="font-display text-lg">Flight layer</h2>
        <p className="text-sm text-crt-dim">
          The flight layer on its own — no table, no choreographer. Box A is a library
          anchor, Box B a hand anchor. Every button drives the same{' '}
          <code className="font-num text-crt-accent-hi">fly()</code> the table uses.
        </p>
      </header>

      <div className="flex items-start gap-16">
        <Anchor zone={BOX_A} label="A · library anchor" height={92} card={card} faceDown />
        <Anchor zone={BOX_B} label="B · hand anchor" height={208} card={card} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TestButton onClick={() => void api.current?.fly({ from: 'a', to: 'b' })}>
          A → B (draw, 420 ms)
        </TestButton>
        <TestButton onClick={() => void api.current?.fly({ from: 'b', to: 'a', arc: 0.1 })}>
          B → A (return)
        </TestButton>
        <TestButton onClick={() => void api.current?.fly({ from: 'a', to: 'missing' })}>
          A → unregistered zone
        </TestButton>
        <TestButton
          onClick={() => void api.current?.fly({ from: 'a', to: 'b', viaMissingCard: true })}
        >
          A → unregistered card slot
        </TestButton>
        <TestButton onClick={() => void api.current?.flyAndCancel()}>
          Cancel mid-flight
        </TestButton>
        <TestButton onClick={() => void api.current?.flyMany(4)}>4 at once</TestButton>
      </div>

      <div className="rounded border border-crt-border bg-crt-inset p-3">
        <h3 className="mb-2 font-sc text-xs tracking-wider text-crt-faint">Result log</h3>
        <ul className="flex flex-col gap-0.5 font-num text-[11px] text-crt-dim">
          {log.length === 0 ? <li className="text-crt-faint">No flights yet.</li> : null}
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A registered zone anchor with a card sitting in it, so sizes are realistic. */
function Anchor({
  zone,
  label,
  height,
  card,
  faceDown = false,
}: {
  zone: ZoneId;
  label: string;
  height: number;
  card: CardData;
  faceDown?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={(el) => register(zoneSlot(zone), el)}
        className="rounded ring-1 ring-crt-border"
        data-anchor={zone}
      >
        <Card card={faceDown ? null : card} height={height} />
      </div>
      <span className="font-sc text-[11px] tracking-wider text-crt-faint">{label}</span>
    </div>
  );
}

function TestButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-crt-border bg-crt-raised px-3 py-1.5 text-xs text-crt-dim transition-colors hover:border-crt-border-hi hover:text-crt-text"
    >
      {children}
    </button>
  );
}

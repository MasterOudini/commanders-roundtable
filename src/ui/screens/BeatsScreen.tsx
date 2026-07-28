import { useEffect, useRef, useState } from 'react';
import { FIXTURE_CARDS } from '../../data/fixtures/cards';
import type { CardData } from '../../data/cardTypes';
import { Card } from '../card/Card';
import { exposeDevHandles } from '../../devHandles';
import { cardSlot, isRegistered, register, resolve, zoneSlot } from '../anim/rectRegistry';
import { recordElement, summarize, type TrackSummary } from '../anim/record';
import { buildGroup } from '../anim/beats';
import { coalesce } from '../anim/coalesce';
import { currentEpoch } from '../anim/flightLayer';
import { burst, fxClear, fxStats, HUE, ring } from '../anim/fx/fxBus';
import { DUR } from '../anim/tokens';
import { emptyView, zoneId, type EngineEvent, type PlayerView } from '../../view/types';

// Dev screen (#beats). Every named beat, in isolation, with per-frame recording.
//
// ⚠️ Why this screen exists rather than judging the beats on the table: on the
// table a beat's endpoints depend on the live layout, so a track that looks wrong
// could be a layout problem, a coalescing problem or a beat problem. Here the
// source and destination are two fixed anchors, so a failing assertion can only be
// the beat. It is also the only place the "does it feel like Arena" question gets a
// NUMBER: peak scale > settle scale means the overshoot actually happened, and
// rotateY crossing 90° at t ≈ 0.5 means the card turned over at the apex of its
// arc rather than at one end.

/** Two anchors and one card is all a beat needs. */
const SRC = zoneId('lib', 'p1');
const DST = zoneId('bf', 'p1');
const GY = zoneId('gy', 'p1');

interface BeatCase {
  id: string;
  label: string;
  note: string;
  /** The engine events this beat comes from — the same path the table uses. */
  events: (card: CardData) => EngineEvent[];
  /** Nominal duration, for the recording window. */
  ms: number;
  /**
   * Which element carries this beat's motion.
   *
   * ⚠️ Getting this wrong silently records nothing. A zone-crossing beat animates a
   * CLONE in the flight overlay; an in-place beat animates the REGISTERED CARD
   * ELEMENT (`data-instance-id`), which is a child of the slot wrapper. Recording
   * the wrapper instead returns a constant transform for 90 frames — the track
   * looks like a beat that never moved, when in fact the wrong node was sampled.
   * `death` is deliberately 'card': its flight is already covered by the flight
   * section, and the part worth asserting here is the desaturate-and-sink.
   */
  target: 'clone' | 'card';
}

const CASES: BeatCase[] = [
  {
    id: 'draw',
    target: 'clone',
    label: 'Draw',
    note: '420 ms, arc 0.22, rotateY crosses 90° at the apex, settles with overshoot.',
    ms: DUR.draw,
    events: () => [{ t: 'CardDrawn', stepId: 1, player: 'p1', instanceId: 'beat-card' }],
  },
  {
    id: 'cast',
    target: 'clone',
    label: 'Cast → stack',
    note: '520 ms arc-to-stack with a travelling colour-identity glow, then a flourish.',
    ms: DUR.castFlight + DUR.flourish,
    events: () => [
      { t: 'SpellCast', stepId: 1, instanceId: 'beat-card', from: SRC, controller: 'p1', stackItemId: 'st1' },
    ],
  },
  {
    id: 'resolve',
    target: 'clone',
    label: 'Resolve → battlefield',
    note: '300 ms accelerating down, then a 260 ms squash-and-rebound thump.',
    ms: DUR.resolve + DUR.landThump,
    events: () => [
      { t: 'StackResolved', stepId: 1, stackItemId: 'st1', instanceId: 'beat-card', to: DST, targets: [] },
      { t: 'PermanentEntered', stepId: 1, instanceId: 'beat-card', isLand: false },
    ],
  },
  {
    id: 'landDrop',
    target: 'clone',
    label: 'Land drop',
    note: 'A deliberately quiet 200 ms — no glow, no ring. Lands happen 40× a game.',
    ms: DUR.landDrop * 2,
    events: () => [
      { t: 'CardMoved', stepId: 1, instanceId: 'beat-card', from: zoneId('hand', 'p1'), to: DST, faceUpAtEnd: true },
    ],
  },
  {
    id: 'move',
    target: 'clone',
    label: 'Generic zone→zone',
    note: 'arc 0.14, 380 ms. Every named beat is a parameterisation of this one.',
    ms: 380,
    events: () => [
      { t: 'CardMoved', stepId: 1, instanceId: 'beat-card', from: SRC, to: GY, faceUpAtEnd: true },
    ],
  },
  {
    id: 'death',
    target: 'card',
    label: 'Death',
    note: '440 ms desaturate-and-drop, then a 300 ms flight to the graveyard.',
    ms: DUR.deathDrop + DUR.resolve,
    events: () => [{ t: 'PermanentDied', stepId: 1, instanceId: 'beat-card' }],
  },
  {
    id: 'reveal',
    target: 'card',
    label: 'Reveal flip',
    note: '340 ms in-place rotateY with a 24 px lift and return. No clone.',
    ms: DUR.revealFlip,
    events: () => [{ t: 'CardRevealed', stepId: 1, instanceId: 'beat-card' }],
  },
  {
    id: 'token',
    target: 'card',
    label: 'Token pop',
    note: 'scale 0.2 → 1.12 → 1. Nothing to fly from, so it pops in place.',
    ms: DUR.resolve,
    events: () => [{ t: 'TokenCreated', stepId: 1, instanceId: 'beat-card' }],
  },
  {
    id: 'counter',
    target: 'card',
    label: 'Counter nudge',
    note: '220 ms spring on the badge — a counter landing should be felt, not read.',
    ms: DUR.counterNudge,
    events: () => [{ t: 'CounterChanged', stepId: 1, instanceId: 'beat-card', kind: '+1/+1', delta: 1 }],
  },
  {
    id: 'damage',
    target: 'card',
    label: 'Damage punch',
    note: '480 ms DOM number, overshoot 1.34, floats up and out. Never canvas.',
    ms: DUR.damagePunch,
    events: () => [
      { t: 'DamageDealt', stepId: 1, target: 'beat-card', targetKind: 'card', amount: 3, commander: false, source: null },
    ],
  },
];

/** A one-card view, so `buildGroup` has the same shape it gets from the engine. */
function beatView(card: CardData, zone: 'lib' | 'bf' | 'stack'): PlayerView {
  const base = emptyView('p1');
  const z = zone === 'stack' ? 'stack' : zoneId(zone, 'p1');
  return {
    ...base,
    seatOrder: ['p1'],
    seats: {
      p1: {
        playerId: 'p1',
        name: 'Ana',
        life: 40,
        cmdDamage: {},
        poison: 0,
        manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        identity: card.colorIdentity,
        lost: false,
      },
    },
    cards: {
      'beat-card': {
        instanceId: 'beat-card',
        card,
        faceIndex: 0,
        faceDown: false,
        controller: 'p1',
        owner: 'p1',
        tapped: false,
        summoningSick: false,
        damage: 0,
        counters: {},
        power: null,
        toughness: null,
        attachedTo: null,
        isCommander: false,
        isToken: false,
        attacking: null,
        blocking: null,
      },
    },
    zones: { [z]: ['beat-card'] } as PlayerView['zones'],
  };
}

export function BeatsScreen() {
  const [tracks, setTracks] = useState<Record<string, TrackSummary | null>>({});
  const card: CardData = FIXTURE_CARDS[0]!;
  const cardRef = useRef(card);
  cardRef.current = card;
  const setTracksRef = useRef(setTracks);
  setTracksRef.current = setTracks;

  useEffect(() => {
    /**
     * Run one beat and record what actually reached the screen.
     *
     * The beat is built through the REAL pipeline — coalesce → buildGroup → run —
     * so this screen cannot pass while the table's path is broken.
     */
    const runBeat = async (id: string) => {
      const def = CASES.find((c) => c.id === id);
      if (!def) return { ran: false };
      const c = cardRef.current;
      const events = def.events(c);
      const intents = coalesce(events);
      const before = beatView(c, id === 'resolve' ? 'stack' : 'lib');
      const after = beatView(c, id === 'draw' ? 'lib' : 'bf');
      const built = buildGroup(intents, {
        epoch: currentEpoch(),
        before,
        after,
        digest: false,
      });

      // Record whichever element the beat actually animates — see BeatCase.target.
      const selector =
        def.target === 'clone' ? '[data-flight-clone]' : '[data-instance-id="beat-card"]';
      const rec = recordElement(selector, def.ms + 400);
      await Promise.all(built.beats.map((b) => b.run()));
      const samples = await rec;
      const track = summarize(samples, def.ms);
      setTracksRef.current((prev) => ({ ...prev, [id]: track }));
      return {
        ran: true,
        id,
        frames: samples.length,
        track,
        beats: built.beats.length,
        // Diagnostics, so a silent no-op is distinguishable from a wrong beat.
        registered: isRegistered(cardSlot('beat-card')),
        selector,
        selectorFound: !!document.querySelector(selector),
        inFlight: built.inFlight.length,
      };
    };

    exposeDevHandles({
      beats: {
        cases: () =>
          CASES.map((c) => ({ id: c.id, label: c.label, note: c.note, ms: c.ms, target: c.target })),
        record: runBeat,
        recordAll: async () => {
          const out: Record<string, unknown> = {};
          for (const c of CASES) {
            out[c.id] = await runBeat(c.id);
            await new Promise((r) => setTimeout(r, 220));
          }
          return out;
        },
        rects: () => ({ src: resolve(null, SRC), dst: resolve(null, DST), gy: resolve(null, GY) }),
      },
      fx: {
        stats: fxStats,
        clear: fxClear,
        burst: (count = 200) => {
          const w = window.innerWidth / 2;
          const h = window.innerHeight / 2;
          burst({
            x: w, y: h, count,
            speedMin: 40, speedMax: 260,
            lifeMin: 300, lifeMax: 700,
            sizeMin: 2, sizeMax: 6,
            hue: HUE.accent,
          });
        },
        ring: () =>
          ring({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            fromRadius: 8,
            toRadius: 90,
            durationMs: 320,
            hue: HUE.accent,
          }),
      },
    });
  }, []);

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <header>
        <h2 className="font-display text-lg">Beats</h2>
        <p className="text-sm text-crt-dim">
          Every named beat, built through the real coalesce → buildGroup → run pipeline
          and recorded per animation frame. <span className="text-crt-accent-hi">Peak</span>{' '}
          above <span className="text-crt-accent-hi">settle</span> is the numeric form of
          &ldquo;it overshoots&rdquo;.
        </p>
      </header>

      <div className="flex items-start gap-12">
        <Anchor zone={SRC} label="library" height={92} card={card} faceDown />
        <div className="flex flex-col items-center gap-2">
          <div
            ref={(el) => register(zoneSlot(DST), el)}
            data-zone={DST}
            data-beat-target=""
            className="rounded ring-1 ring-crt-border"
          >
            {/* The card the in-place beats animate. `data-beat-card` is what the
                recorder watches when no clone is involved. */}
            <div data-beat-card="">
              <Card card={card} height={148} instanceId="beat-card" />
            </div>
          </div>
          <span className="font-sc text-[11px] tracking-wider text-crt-faint">battlefield</span>
        </div>
        <Anchor zone={GY} label="graveyard" height={92} card={card} />
        <div ref={(el) => register(zoneSlot('stack'), el)} data-zone="stack" className="opacity-40">
          <Card card={card} height={132} registerSlot={false} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {CASES.map((c) => {
          const t = tracks[c.id];
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded border border-crt-border/60 bg-crt-inset px-2 py-1"
            >
              <button
                type="button"
                onClick={() => {
                  const handles = (window as unknown as { __crt?: { beats?: { record: (id: string) => void } } }).__crt;
                  handles?.beats?.record(c.id);
                }}
                className="w-40 shrink-0 rounded bg-crt-raised px-2 py-1 text-left text-xs text-crt-dim hover:text-crt-text"
              >
                {c.label}
              </button>
              <span className="flex-1 text-[11px] text-crt-faint">{c.note}</span>
              {t && (
                <span className="crt-num shrink-0 text-[11px]">
                  <span className="text-crt-faint">frames</span> {t.frames} ·{' '}
                  <span className="text-crt-faint">peak</span>{' '}
                  <span className={t.scale.peak > t.scale.last ? 'text-crt-ok' : 'text-crt-danger'}>
                    {t.scale.peak.toFixed(3)}
                  </span>{' '}
                  <span className="text-crt-faint">settle</span> {t.scale.last.toFixed(3)}
                  {t.flipAtT !== null && (
                    <>
                      {' · '}
                      <span className="text-crt-faint">flip@</span>
                      <span
                        className={
                          t.flipAtT >= 0.45 && t.flipAtT <= 0.55 ? 'text-crt-ok' : 'text-crt-warn'
                        }
                      >
                        {t.flipAtT.toFixed(3)}
                      </span>
                    </>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Anchor({
  zone,
  label,
  height,
  card,
  faceDown = false,
}: {
  zone: string;
  label: string;
  height: number;
  card: CardData;
  faceDown?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={(el) => register(zoneSlot(zone as never), el)}
        data-zone={zone}
        className="rounded ring-1 ring-crt-border"
      >
        <Card card={faceDown ? null : card} height={height} registerSlot={false} />
      </div>
      <span className="font-sc text-[11px] tracking-wider text-crt-faint">{label}</span>
    </div>
  );
}

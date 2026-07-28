// The named beats. One function per BeatIntent kind, each returning a runnable
// Beat with its resource keys and duration declared up front.
//
// ⚠️ SOURCE RECTS ARE READ HERE, DURING BUILD, BEFORE THE VIEW IS COMMITTED. That
// ordering is the whole commit-then-fly protocol and it is not negotiable: once
// the view commits, the card is no longer in its old zone, so its old position is
// unrecoverable. Destinations are the opposite — they are resolved LATE, inside
// the clone, after React has rendered the destination slot with
// `visibility: hidden` so its geometry is final. Reading the destination early
// aims the flight at where the slot was about to be.
//
// Two mechanisms only, per the flight-layer decision: this file uses the imperative
// flight layer for anything crossing a zone, and imperative `animate(element, …)`
// for beats that happen INSIDE a zone (thump, tap, death fade, token pop). No
// `layoutId` anywhere.

import { animate } from 'motion';
import type { CardData } from '../../data/cardTypes';
import { identityToken } from '../../data/cardTypes';
import { useAnim } from '../../store/animStore';
import type { InstanceId, PlayerView, ZoneId } from '../../view/types';
import { zoneId } from '../../view/types';
import type { BeatIntent } from './coalesce';
import { fly, genericFlight, type FlightSpec } from './flightLayer';
import { burst, hueForIdentity, ring, HUE } from './fx/fxBus';
import {
  cardSlot,
  elementFor,
  readAll,
  readElements,
  resolve,
  takeDropOrigin,
  zoneSlot,
  type FrozenRect,
  type SlotKey,
} from './rectRegistry';
import { DUR, EASE, SPRING, STAGGER, d, ds, staggerFor } from './tokens';
import { useLayout } from '../../store/layoutStore';
import {
  clearCombatPoses,
  planAttacks,
  planBlocks,
  runAttacks,
  runBlocks,
  type AttackPlan,
  type BlockPlan,
} from './combat';

export type Lane = 'card' | 'overlay' | 'hud';

export interface Beat {
  id: string;
  lane: Lane;
  /**
   * The epoch this beat was BUILT in. The choreographer stamps it and discards any
   * beat whose epoch no longer matches — one guard that kills every async race
   * across a reconnect.
   */
  epochAtBuild?: number;
  /**
   * Resources this beat locks. Beats with DISJOINT keys run concurrently; beats
   * sharing a key serialize. That is what lets a draw and a life count overlap
   * while two moves of the same card cannot.
   */
  keys: string[];
  durationMs: number;
  run: () => Promise<void>;
}

export interface BuildContext {
  epoch: number;
  /** The view BEFORE this group — what the source rects belong to. */
  before: PlayerView;
  /** The view AFTER this group — what the destinations belong to. */
  after: PlayerView;
  /** No clones, no flights: a 140 ms fade and an outline pulse instead. */
  digest: boolean;
}

export interface BuiltGroup {
  beats: Beat[];
  /** Cards whose slots must render hidden while their clones fly. */
  inFlight: InstanceId[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The last combat plans, kept so end-of-combat can return exactly the cards it
 * posed, and so the battery can assert against the numbers the animation used.
 */
let lastAttackPlans: AttackPlan[] = [];
let lastBlockPlans: BlockPlan[] = [];
/**
 * A copy that end-of-combat does NOT clear.
 *
 * ⚠️ `lastAttackPlans` is working state: the end-of-combat beat consumes it to know
 * which cards it has to return to their resting pose, and therefore empties it. The
 * battery inspects the plans AFTER a full combat sequence has run, so reading the
 * working copy reported "0 attackers planned" for a combat that had in fact planned
 * four. Keep the inspection copy separate from the working one.
 */
let recordedAttackPlans: AttackPlan[] = [];
let recordedBlockPlans: BlockPlan[] = [];

export function combatPlans(): { attacks: AttackPlan[]; blocks: BlockPlan[] } {
  return { attacks: recordedAttackPlans, blocks: recordedBlockPlans };
}

/** Card data for a beat, taken from whichever view still has it. */
function cardOf(ctx: BuildContext, id: InstanceId): CardData | null {
  return ctx.after.cards[id]?.card ?? ctx.before.cards[id]?.card ?? null;
}

function identityOf(ctx: BuildContext, id: InstanceId): string[] {
  return cardOf(ctx, id)?.colorIdentity ?? [];
}

function centre(r: FrozenRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * A tapped card's rect is the card lying on its side. A flight clone is always
 * upright, and it takes its starting SIZE from this rect — so a dying attacker
 * would begin its flight 28 % too small and grow on the way to the graveyard.
 * Stand the box up about the same centre: the card keeps its size, and only its
 * orientation snaps.
 *
 * ⚠️ Gated on the card actually being tapped, not on the rect being wider than
 * tall. An opponent's hand anchor is a COUNT CHIP — wide and short — and swapping
 * that would send every one of their draws to the wrong place.
 */
function uprightSource(r: FrozenRect, tapped: boolean): FrozenRect {
  if (!tapped || r.width <= r.height) return r;
  const c = centre(r);
  return { left: c.x - r.height / 2, top: c.y - r.width / 2, width: r.height, height: r.width };
}

/**
 * A digest decoration in place of a flight. Never a clone.
 *
 * ⚠️ THROUGH `d()`, like every other duration in this file. It was the one beat
 * that hard-coded a raw millisecond value, and the cost was exactly what the rule
 * in `tokens.ts` predicts: the digest beat could not be scaled by the governor,
 * sped up by hold-to-fast-forward, or shortened by the speed setting. So
 * `animationSpeed: 'off'` — labelled "instant" in Settings — still cost 140 ms
 * PER GROUP, and a five-group cast-and-resolve took 541 ms to reach its final
 * board with nothing on screen to show for the wait. Measured by the M5 motion
 * battery; with `d()` in place, speed Off scales to 0 and converges in one frame.
 */
function digestPulse(key: string, color: string): Promise<void> {
  const ms = d(DUR.digest);
  useAnim.getState().pulse(key, color, ms);
  return sleep(ms);
}

export function buildGroup(intents: BeatIntent[], ctx: BuildContext): BuiltGroup {
  const beats: Beat[] = [];
  const inFlight: InstanceId[] = [];
  let seq = 0;
  const nextId = (kind: string) => `${kind}-${ctx.epoch}-${++seq}`;

  // ── One batched rect read for every source this group needs ────────────────
  // ⚠️ ONE call, before any state write. Reading per beat would force a separate
  // layout flush each time; a six-card draw would do six.
  const sourceKeys = new Set<SlotKey>();
  for (const intent of intents) {
    switch (intent.kind) {
      case 'draw':
        sourceKeys.add(zoneSlot(zoneId('lib', intent.player)));
        for (const id of intent.instanceIds) sourceKeys.add(cardSlot(id));
        break;
      case 'flight':
        sourceKeys.add(cardSlot(intent.instanceId));
        sourceKeys.add(zoneSlot(intent.from));
        break;
      case 'death':
        for (const id of intent.instanceIds) sourceKeys.add(cardSlot(id));
        break;
      case 'damage':
        if (intent.targetKind === 'card') sourceKeys.add(cardSlot(intent.target));
        break;
      default:
        break;
    }
  }
  const sources = readAll([...sourceKeys]);
  // ⚠️ The drop origin comes FIRST, ahead of the card's own slot. A card played by
  // dragging is already lying where the player put it; its hand slot is where it
  // used to be, and flying from there would snap it back into the fan for one
  // frame before flying it out again. One use, then the entry is gone — see
  // `setDropOrigin`.
  const sourceFor = (id: InstanceId, zone: ZoneId): FrozenRect =>
    takeDropOrigin(id) ?? sources.get(cardSlot(id)) ?? sources.get(zoneSlot(zone)) ?? resolve(id, zone);

  for (const intent of intents) {
    switch (intent.kind) {
      case 'draw': {
        const mine = intent.player === ctx.after.me;
        const ids = intent.instanceIds;
        const step = staggerFor(ids.length, STAGGER.draw);
        const total = d(DUR.draw) + step * Math.max(0, ids.length - 1);
        if (!ctx.digest) inFlight.push(...ids);
        const libRect = sources.get(zoneSlot(zoneId('lib', intent.player)));
        beats.push({
          id: nextId('draw'),
          lane: 'card',
          keys: [...ids.map(cardSlot), zoneSlot(zoneId('hand', intent.player))],
          durationMs: total,
          run: async () => {
            if (ctx.digest) {
              await digestPulse(zoneSlot(zoneId('hand', intent.player)), 'var(--color-crt-accent)');
              return;
            }
            await Promise.all(
              ids.map(async (id, i) => {
                if (step > 0 && i > 0) await sleep(step * i);
                const from = libRect ?? resolve(null, zoneId('lib', intent.player));
                await fly({
                  instanceId: id,
                  epoch: ctx.epoch,
                  from,
                  // Mine lands on its own hand slot; an opponent's lands on their
                  // hand-count CHIP, because their hand is a count, not a fan.
                  to: mine ? cardSlot(id) : zoneSlot(zoneId('hand', intent.player)),
                  card: mine ? cardOf(ctx, id) : null,
                  faceUpAtStart: false,
                  // An opponent's card never turns over — that would leak it.
                  faceUpAtEnd: mine,
                  arc: 0.22,
                  durationMs: d(DUR.draw),
                  ease: 'flight',
                  peakScale: 1.14,
                  landing: 'settle',
                  ...(mine ? {} : { faceMode: 'back' as const }),
                });
                if (mine) await settleInHand(id);
              }),
            );
          },
        });
        break;
      }

      case 'flight': {
        const id = intent.instanceId;
        const card = cardOf(ctx, id);
        const from = uprightSource(
          sourceFor(id, intent.from),
          ctx.before.cards[id]?.tapped === true,
        );
        const identity = identityOf(ctx, id);
        if (!ctx.digest) inFlight.push(id);
        const spec = flightSpecFor(intent.as, {
          instanceId: id,
          epoch: ctx.epoch,
          from,
          to: destinationFor(intent.to, id),
          card,
          faceUpAtStart: ctx.before.cards[id]?.card !== null,
          faceUpAtEnd: intent.faceUpAtEnd,
          identity,
        });
        beats.push({
          id: nextId(intent.as),
          lane: 'card',
          keys: [cardSlot(id), zoneSlot(intent.from), zoneSlot(intent.to)],
          durationMs: spec.durationMs + (intent.as === 'resolve' ? d(DUR.landThump) : 0),
          run: async () => {
            if (ctx.digest) {
              await digestPulse(zoneSlot(intent.to), identityToken(identity as never));
              return;
            }
            await fly(spec);
            if (intent.as === 'resolve' || intent.as === 'land') {
              await landingFor(intent.as, id, identity);
            }
          },
        });
        break;
      }

      case 'flourish': {
        // The stack arrival: a ring plus a burst, on the OVERLAY lane so it never
        // blocks a card beat.
        const identity = intent.instanceId ? identityOf(ctx, intent.instanceId) : [];
        beats.push({
          id: nextId('flourish'),
          lane: 'overlay',
          keys: [zoneSlot('stack')],
          // ⚠️ In digest mode this is a DIGEST pulse, not a 360 ms one. It used to
          // skip only the particles and still sleep the full flourish, which made
          // it the longest thing in a mode whose entire vocabulary is "one fade"
          // (see DUR.digest). Measured cost: a cast-and-resolve took 546 ms to
          // commit its final board under reduced motion, because the NEXT group
          // cannot start until this beat finishes — 360 ms of waiting with
          // nothing on screen to show for it, for a user who asked for less
          // motion. Now 140 ms, like every other digest decoration.
          durationMs: ctx.digest ? d(DUR.digest) : d(DUR.flourish),
          run: async () => {
            if (ctx.digest) {
              await digestPulse(zoneSlot('stack'), identityToken(identity as never));
              return;
            }
            const r = resolve(intent.instanceId, 'stack');
            const c = centre(r);
            const hue = hueForIdentity(identity);
            ring({ x: c.x, y: c.y, fromRadius: 8, toRadius: 64, durationMs: d(320), hue });
            burst({
              x: c.x, y: c.y, count: 26,
              speedMin: 60, speedMax: 170,
              lifeMin: 380, lifeMax: 620,
              sizeMin: 2, sizeMax: 5,
              hue,
            });
            useAnim.getState().pulse(zoneSlot('stack'), identityToken(identity as never), d(DUR.flourish));
            await sleep(d(DUR.flourish));
          },
        });
        break;
      }

      case 'tapSweep': {
        // ⚠️ The stagger is a CSS `transition-delay`, not twelve JavaScript
        // animations. Card already animates its tap rotation with a transition, so
        // handing each card an index-derived delay produces the 34 ms wave for
        // free — and it stays correct if the row re-packs mid-sweep.
        const step = d(STAGGER.untapSweep);
        const total = d(DUR.tap) + step * Math.max(0, intent.instanceIds.length - 1);
        beats.push({
          id: nextId(intent.untap ? 'untapSweep' : 'tapSweep'),
          lane: 'card',
          keys: intent.instanceIds.map(cardSlot),
          durationMs: total,
          run: async () => {
            for (const band of ['combat', 'support'] as const) {
              useAnim
                .getState()
                .sweepRow(`${intent.player}:${band}`, total, intent.instanceIds, step);
            }
            await sleep(total);
          },
        });
        break;
      }

      case 'enter': {
        // Usually the tail of a flight, which already ran its own landing. This
        // covers a permanent that appeared without moving (a copy, a manual put).
        beats.push({
          id: nextId('enter'),
          lane: 'card',
          keys: [cardSlot(intent.instanceId)],
          durationMs: intent.isLand ? d(DUR.landDrop) : d(DUR.landThump),
          run: async () => {
            if (ctx.digest) return;
            await landingFor(
              intent.isLand ? 'land' : 'resolve',
              intent.instanceId,
              identityOf(ctx, intent.instanceId),
            );
          },
        });
        break;
      }

      case 'damage': {
        const rect =
          intent.targetKind === 'card'
            ? (sources.get(cardSlot(intent.target)) ?? resolve(intent.target, 'stack'))
            : plateRectFor(intent.target);
        beats.push({
          id: nextId('damage'),
          lane: 'overlay',
          keys: [`dmg:${intent.target}`],
          durationMs: d(DUR.damagePunch),
          run: async () => {
            const kind = intent.commander ? 'commander' : intent.amount < 0 ? 'gain' : 'damage';
            useAnim.getState().addBadge(
              {
                x: rect.left + rect.width - 8,
                y: rect.top - 6,
                text: intent.commander ? `${intent.amount}` : `${-Math.abs(intent.amount)}`,
                kind,
              },
              d(DUR.damagePunch),
            );
            if (!ctx.digest && intent.targetKind === 'card') {
              const el = elementFor(cardSlot(intent.target));
              if (el) {
                // A flinch, so damage reads as an impact rather than a number
                // appearing. Brightness and x only — both composited.
                void animate(
                  el,
                  { filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'], x: [0, -4, 3, 0] },
                  { duration: ds(180), ease: EASE.out },
                );
              }
              const c = centre(rect);
              burst({
                x: c.x, y: c.y, count: 18,
                speedMin: 80, speedMax: 220,
                lifeMin: 240, lifeMax: 420,
                sizeMin: 2, sizeMax: 4,
                hue: intent.commander ? HUE.cmd : HUE.danger,
                gravity: 120,
              });
            }
            await sleep(d(DUR.damagePunch));
          },
        });
        break;
      }

      case 'life': {
        // ⚠️ Zero duration, HUD lane, never blocks. LifeCounter animates itself
        // from the committed view and RETARGETS in flight; queueing a beat per
        // change is exactly what would make it restart instead.
        beats.push({
          id: nextId('life'),
          lane: 'hud',
          keys: [`life:${intent.player}`],
          durationMs: 0,
          run: async () => {},
        });
        break;
      }

      case 'counter': {
        beats.push({
          id: nextId('counter'),
          lane: 'card',
          keys: [cardSlot(intent.instanceId)],
          durationMs: d(DUR.counterNudge),
          run: async () => {
            if (ctx.digest) return;
            const el = elementFor(cardSlot(intent.instanceId));
            if (el) {
              // ⚠️ duration + ease, NOT a spring. `motion` silently produces NO
              // animation for a multi-keyframe array with a spring transition — the
              // element's transform stayed constant for all 76 recorded frames,
              // which reads as "this beat does nothing" rather than as a bad
              // transition type. Springs are for two-value transitions; a
              // there-and-back bump needs an eased duration. EASE.overshoot also
              // gives the peak-above-settle the beats battery asserts on.
              await animate(
                el,
                { scale: [1, 1.06, 1] },
                { duration: ds(DUR.counterNudge), ease: EASE.overshoot },
              );
            } else {
              await sleep(d(DUR.counterNudge));
            }
          },
        });
        break;
      }

      case 'death': {
        const ids = intent.instanceIds;
        if (!ctx.digest) inFlight.push(...ids);
        beats.push({
          id: nextId('death'),
          lane: 'card',
          keys: ids.map(cardSlot),
          durationMs: d(DUR.deathDrop) + d(DUR.resolve),
          run: async () => {
            await Promise.all(
              ids.map(async (id) => {
                const owner = ctx.before.cards[id]?.owner ?? ctx.after.me;
                const gy = zoneId('gy', owner);
                if (ctx.digest) {
                  await digestPulse(zoneSlot(gy), 'var(--color-crt-faint)');
                  return;
                }
                const el = elementFor(cardSlot(id));
                if (el) {
                  // Desaturate and sink first: a card that simply flies to the
                  // graveyard reads as being moved, not as dying.
                  await animate(
                    el,
                    {
                      scale: [1, 0.96, 0.82],
                      opacity: [1, 0.85, 0.35],
                      rotate: [0, 3, 8],
                      y: [0, 8, 26],
                      filter: ['grayscale(0)', 'grayscale(0.7) brightness(0.7)', 'grayscale(1) brightness(0.6)'],
                    },
                    { duration: ds(DUR.deathDrop), ease: EASE.in },
                  );
                }
                const from = sources.get(cardSlot(id)) ?? resolve(id, gy);
                await fly({
                  instanceId: id,
                  epoch: ctx.epoch,
                  from,
                  to: zoneSlot(gy),
                  card: cardOf(ctx, id),
                  faceUpAtStart: true,
                  faceUpAtEnd: true,
                  arc: 0.08,
                  durationMs: d(DUR.resolve),
                  ease: 'in',
                });
                const c = centre(from);
                burst({
                  x: c.x, y: c.y, count: 10,
                  speedMin: 10, speedMax: 50,
                  lifeMin: 380, lifeMax: 520,
                  sizeMin: 2, sizeMax: 4,
                  hue: HUE.b, gravity: 90,
                });
              }),
            );
          },
        });
        break;
      }

      case 'token': {
        beats.push({
          id: nextId('token'),
          lane: 'card',
          keys: intent.instanceIds.map(cardSlot),
          durationMs: d(DUR.resolve),
          run: async () => {
            if (ctx.digest) return;
            // A token has nothing to fly FROM, so it pops in place. The overshoot
            // past 1 is what distinguishes "created" from "moved here".
            await Promise.all(
              intent.instanceIds.map(async (id) => {
                const el = elementFor(cardSlot(id));
                if (!el) return sleep(d(DUR.resolve));
                const r = resolve(id, zoneId('bf', ctx.after.cards[id]?.controller ?? ctx.after.me));
                const c = centre(r);
                burst({
                  x: c.x, y: c.y, count: 20,
                  speedMin: 40, speedMax: 150,
                  lifeMin: 260, lifeMax: 460,
                  sizeMin: 2, sizeMax: 4,
                  hue: hueForIdentity(identityOf(ctx, id)),
                });
                return animate(
                  el,
                  { scale: [0.2, 1.12, 1], opacity: [0, 1, 1] },
                  { duration: ds(DUR.resolve), ease: EASE.overshoot },
                );
              }),
            );
          },
        });
        break;
      }

      case 'reveal': {
        beats.push({
          id: nextId('reveal'),
          lane: 'card',
          keys: [cardSlot(intent.instanceId)],
          durationMs: d(DUR.revealFlip),
          run: async () => {
            if (ctx.digest) return;
            const el = elementFor(cardSlot(intent.instanceId));
            if (!el) return sleep(d(DUR.revealFlip));
            // In place: lift, turn, return. Nothing crosses a zone, so no clone.
            return animate(
              el,
              { rotateY: [180, 90, 0], y: [0, -24, 0], scale: [1, 1.06, 1] },
              { duration: ds(DUR.revealFlip), ease: EASE.inOut },
            );
          },
        });
        break;
      }

      case 'attack': {
        // ⚠️ Planned during BUILD, so the plan is recorded and the battery can
        // assert against the SAME numbers the animation used rather than against a
        // re-derivation that could drift.
        const metrics = useLayout.getState().metrics;
        const plans = planAttacks(intent.attackers, metrics.seatCount);
        lastAttackPlans = plans;
        recordedAttackPlans = plans;
        beats.push({
          id: nextId('attack'),
          lane: 'card',
          keys: intent.attackers.map((a) => cardSlot(a.instanceId)),
          durationMs: d(DUR.attackLunge) + d(STAGGER.attackers) * Math.max(0, plans.length - 1),
          run: async () => {
            if (ctx.digest) return;
            await runAttacks(plans);
          },
        });
        break;
      }

      case 'block': {
        const metrics = useLayout.getState().metrics;
        const plans = planBlocks(intent.blocks, metrics.cardW.bf);
        lastBlockPlans = plans;
        recordedBlockPlans = plans;
        beats.push({
          id: nextId('block'),
          lane: 'card',
          keys: intent.blocks.map((b) => cardSlot(b.blocker)),
          durationMs: d(DUR.blockSlide) + d(STAGGER.blockers) * Math.max(0, plans.length - 1),
          run: async () => {
            if (ctx.digest) return;
            await runBlocks(plans);
          },
        });
        break;
      }

      case 'phase': {
        // Phase and mana are pure HUD: they animate from the committed view and
        // must never occupy the queue.
        if (intent.phase === 'endCombat' || intent.phase === 'untap') {
          const combatants = Object.values(ctx.after.cards)
            .filter((c) => c.attacking !== null || c.blocking !== null)
            .map((c) => c.instanceId);
          const posed = [...lastAttackPlans.map((p) => p.instanceId), ...lastBlockPlans.map((p) => p.blocker), ...combatants];
          lastAttackPlans = [];
          lastBlockPlans = [];
          beats.push({
            id: nextId('clearCombat'),
            lane: 'card',
            keys: posed.map(cardSlot),
            durationMs: d(DUR.resolve),
            run: () => clearCombatPoses([...new Set(posed)]),
          });
          break;
        }
        beats.push({ id: nextId('phase'), lane: 'hud', keys: ['phase'], durationMs: 0, run: async () => {} });
        break;
      }

      case 'mana': {
        beats.push({ id: nextId('mana'), lane: 'hud', keys: ['mana'], durationMs: 0, run: async () => {} });
        break;
      }
    }
  }

  return { beats, inFlight };
}

/** The destination a flight should aim at: the card's new slot, or its zone anchor. */
function destinationFor(to: ZoneId, id: InstanceId): SlotKey {
  // A card slot is preferred, but `resolve` falls through to the zone anchor if it
  // is not registered — which is what makes a hidden or collapsed destination work
  // with no special case.
  return to === 'stack' ? zoneSlot('stack') : cardSlot(id);
}

interface SpecInput {
  instanceId: InstanceId;
  epoch: number;
  from: FrozenRect;
  to: SlotKey;
  card: CardData | null;
  faceUpAtStart: boolean;
  faceUpAtEnd: boolean;
  identity: string[];
}

function flightSpecFor(as: 'move' | 'cast' | 'resolve' | 'land', input: SpecInput): FlightSpec {
  const glow = `color-mix(in oklab, ${identityToken(input.identity as never)} 70%, transparent)`;
  switch (as) {
    case 'cast':
      // ⚠️ The spec's 100 ms pre-lift is NOT here, deliberately (D20). A lift
      // before the state commit would have to run before the view changes, which
      // would gate the commit on an animation and break the lag model. The lift
      // belongs to the INPUT affordance — in M3, clicking a card to cast it lifts
      // it locally while the intent is in flight to the host. The arc plus the
      // early size swell carry the "thrown from the hand" read on their own.
      return {
        ...genericFlight(input.instanceId, input.card, input.from, input.to, {
          epoch: input.epoch,
          arc: 0.18,
          durationMs: d(DUR.castFlight),
          ease: 'flight',
          faceUpAtStart: input.faceUpAtStart,
          faceUpAtEnd: input.faceUpAtEnd,
          glow,
          landing: 'settle',
          z: 20,
        }),
      };
    case 'resolve':
      return genericFlight(input.instanceId, input.card, input.from, input.to, {
        epoch: input.epoch,
        arc: 0.1,
        durationMs: d(DUR.resolve),
        // Accelerating DOWN into the slot is what makes a permanent land rather
        // than arrive.
        ease: 'in',
        faceUpAtStart: input.faceUpAtStart,
        faceUpAtEnd: input.faceUpAtEnd,
        landing: 'thump',
        z: 15,
      });
    case 'land':
      // Lands happen 40× a game. This is deliberately the quietest beat on the
      // table: no glow, no dust, no ring. That restraint is what keeps the table
      // from feeling like a slot machine.
      return genericFlight(input.instanceId, input.card, input.from, input.to, {
        epoch: input.epoch,
        arc: 0.06,
        durationMs: d(DUR.landDrop),
        ease: 'out',
        faceUpAtStart: input.faceUpAtStart,
        faceUpAtEnd: input.faceUpAtEnd,
        landing: 'drop',
        peakScale: 1.02,
      });
    case 'move':
    default:
      return genericFlight(input.instanceId, input.card, input.from, input.to, {
        epoch: input.epoch,
        faceUpAtStart: input.faceUpAtStart,
        faceUpAtEnd: input.faceUpAtEnd,
        arc: 0.14,
        durationMs: d(380),
      });
  }
}

/** The squash-and-rebound (or the quiet land flash) after a flight lands. */
async function landingFor(
  as: 'resolve' | 'land',
  id: InstanceId,
  identity: string[],
): Promise<void> {
  const el = elementFor(cardSlot(id));
  if (!el) return;
  const r = resolve(id, 'stack');
  const c = centre(r);

  if (as === 'land') {
    burst({
      x: c.x, y: c.y + r.height / 2, count: 4,
      speedMin: 10, speedMax: 40, lifeMin: 200, lifeMax: 320,
      sizeMin: 1, sizeMax: 2, hue: HUE.dust, gravity: 140,
    });
    await animate(el, { scaleY: [1, 0.94, 1] }, { duration: ds(DUR.landDrop), ease: EASE.out });
    return;
  }

  burst({
    x: c.x, y: c.y + r.height / 2, count: 14,
    speedMin: 40, speedMax: 90, lifeMin: 320, lifeMax: 480,
    sizeMin: 2, sizeMax: 4, hue: hueForIdentity(identity), gravity: 140,
    direction: -Math.PI / 2, spread: Math.PI * 0.8,
  });
  // ⚠️ Same trap as the counter nudge: a FOUR-keyframe squash cannot use
  // SPRING.thump, because motion produces no animation at all for a multi-keyframe
  // array with a spring transition. EASE.impact is the eased equivalent — it slams
  // and then rebounds past 1, which is the whole point of a thump.
  await animate(
    el,
    {
      scaleY: [1, 0.9, 1.04, 1],
      scaleX: [1, 1.08, 0.98, 1],
      y: [0, 5, -2, 0],
    },
    { duration: ds(DUR.landThump), ease: EASE.impact },
  );
}

/** The hand card's arrival bounce, once its clone has landed. */
async function settleInHand(id: InstanceId): Promise<void> {
  const el = elementFor(cardSlot(id));
  if (!el) return;
  await animate(el, { y: [10, 0], scale: [1.06, 1] }, SPRING.settle);
}

/** Where a player's floating damage number should appear. */
function plateRectFor(player: string): FrozenRect {
  // ⚠️ Through readElements, not a bare getBoundingClientRect. A raw call here both
  // escapes the per-frame read cache (so it forces its own full-table layout flush)
  // and shows up in the perf report's stray-read counter, which is the signal that
  // the rect discipline has been broken somewhere.
  const el = document.querySelector(`[data-plate="${player}"]`);
  const [r] = readElements([el]);
  return r ?? resolve(null, zoneId('bf', player));
}

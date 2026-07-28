// Canned scenarios — the M2 verification vehicle.
//
// ⚠️ These bypass pointer events ENTIRELY, and that is the point. The workspace
// rule is "assert on store-injected state, never synthetic pointer drags" (genuine
// and synthetic pointermoves interleave and corrupt the gesture when the real mouse
// is over the Electron window). A scenario drives the table through exactly the
// interface the engine will use — `(events, viewAfter)` batches — so it tests the
// real path while being perfectly reproducible.
//
// Each scenario returns a list of batches. The caller decides whether to ingest
// them all in ONE tick (which is what exercises the speed governor, coalescing and
// drain mode) or spaced out (which is what a human watches).

import type { CardData } from '../../data/cardTypes';
import type { Batch, FixtureTable } from './table';
import type { InstanceId, PlayerId } from '../types';

export interface ScenarioContext {
  table: FixtureTable;
  /** Cards available for tokens and the like. */
  pool: CardData[];
}

export interface ScenarioDef {
  id: string;
  label: string;
  /** What this proves, shown on the table screen next to the button. */
  note: string;
  run: (ctx: ScenarioContext, opts?: Record<string, number>) => Batch[];
  /** Suggested gap between batches when a human is watching, in ms. */
  gapMs?: number;
}

const first = <T,>(arr: T[]): T | undefined => arr[0];

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'drawBurst',
    label: 'Draw burst',
    note: 'n draws in one group → ONE staggered beat, not n queued flights.',
    gapMs: 0,
    run: ({ table }, opts) => [table.draw(table.playerIds()[0]!, opts?.n ?? 6)],
  },

  {
    id: 'openingHand',
    label: 'Opening hand (7)',
    note: '7 cards at stagger min(60, 420/n) → 780 ms total, not 4 s.',
    gapMs: 0,
    run: ({ table }) => [table.draw(table.playerIds()[0]!, 7)],
  },

  {
    id: 'opponentDraw',
    label: 'Opponent draws',
    note: 'Card backs to the hand-count chip; the number nudges on arrival.',
    gapMs: 0,
    run: ({ table }) => {
      const others = table.playerIds().slice(1);
      return others.map((p) => table.draw(p, 2));
    },
  },

  {
    id: 'castResolve',
    label: 'Cast → stack → battlefield',
    note: 'lift → 520 ms arc with a travelling glow → flourish → thump.',
    gapMs: 700,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      const hand = table.in('hand', me);
      const id = first(hand);
      if (!id) return [];
      return [table.cast(id), table.resolveTop()];
    },
  },

  {
    id: 'landDrop',
    label: 'Land drop (quiet)',
    note: 'A deliberately restrained 200 ms — lands happen 40× a game.',
    gapMs: 400,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      const id = first(table.in('hand', me));
      if (!id) return [];
      return [table.playLand(id)];
    },
  },

  {
    id: 'tapAndUntap',
    label: 'Tap row, then untap all',
    note: 'n taps in a row coalesce into ONE row sweep at 34 ms stagger.',
    gapMs: 600,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      const bf = table.in('bf', me).slice(0, 8);
      return [table.tap(bf), table.untapAll(me)];
    },
  },

  {
    id: 'lifeSwings',
    label: 'Life swings 40→33→31→45',
    note: 'The counter RETARGETS mid-count; it must never return to 40.',
    gapMs: 80,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      return [
        table.changeLife(me, -7),
        table.changeLife(me, -2),
        table.changeLife(me, +14),
      ];
    },
  },

  {
    id: 'moveBurst',
    label: 'Move burst (20 in one tick)',
    note: 'The governor climbs, then drains. State must converge EXACTLY.',
    gapMs: 0,
    run: ({ table }, opts) => {
      const n = opts?.n ?? 20;
      const me = table.playerIds()[0]!;
      const batches: Batch[] = [];
      // Deterministic, not random: a scenario that differs between runs cannot be
      // used to diagnose a failure.
      const sources = [
        ...table.in('bf', me),
        ...table.in('hand', me),
        ...table.in('gy', me),
      ];
      const targets = ['gy', 'exile', 'hand', 'bf'] as const;
      for (let i = 0; i < n; i++) {
        const id = sources[i % sources.length];
        if (!id) break;
        batches.push(table.moveCard(id, targets[i % targets.length]!, me));
      }
      return batches;
    },
  },

  {
    id: 'damageVolley',
    label: 'Damage volley',
    note: 'Damage to one target sums into ONE punch per group.',
    gapMs: 220,
    run: ({ table }) => {
      const [me, ...others] = table.playerIds();
      if (!me) return [];
      const batches: Batch[] = [];
      for (const p of others) {
        batches.push(table.damagePlayer(p, 4, { source: null }));
      }
      const target = first(table.creaturesOf(me));
      if (target) batches.push(table.damageCard(target, 2));
      return batches;
    },
  },

  {
    id: 'combatDeclare',
    label: 'Combat: declare only',
    note: 'Stops after blockers are declared, so the lunge and intercept POSES persist.',
    gapMs: 500,
    run: ({ table }) => {
      const [me, ...others] = table.playerIds();
      if (!me || others.length === 0) return [];
      const mine = table.creaturesOf(me).slice(0, 5);
      if (mine.length === 0) return [];
      const defenderA = others[0]!;
      const defenderB = others[1] ?? others[0]!;
      const attackers = mine.map((instanceId, i) => ({
        instanceId,
        defender: i % 2 === 0 ? defenderA : defenderB,
      }));
      const blockerPool = table.creaturesOf(defenderA).slice(0, 3);
      const blocks = blockerPool.map((blocker, i) => ({
        blocker,
        attacker: attackers[i % attackers.length]!.instanceId,
      }));
      // ⚠️ Deliberately STOPS here — no combatDamage, no destroy, no endCombat.
      // The full combat4p sequence ends by returning every combatant to its resting
      // pose, so sampling the DOM after it reports every blocker as having moved
      // 0 px. Measuring a transient pose needs a scenario that leaves it standing.
      return [
        table.setPhase('attackers', me),
        table.declareAttackers(attackers),
        table.setPhase('blockers', me),
        table.declareBlockers(blocks),
      ];
    },
  },

  {
    id: 'combat4p',
    label: 'Combat: 5 attackers, 2 defenders, 3 blockers',
    note: 'Each attacker lunges TOWARD its assigned pod; blockers intercept.',
    gapMs: 800,
    run: ({ table }) => {
      const [me, ...others] = table.playerIds();
      if (!me || others.length === 0) return [];
      const mine = table.creaturesOf(me).slice(0, 5);
      if (mine.length === 0) return [];

      // Split the attack across two defenders, so the dot-product assertion has
      // something to distinguish: the lunges must point in different directions.
      const defenderA = others[0]!;
      const defenderB = others[1] ?? others[0]!;
      const attackers = mine.map((instanceId, i) => ({
        instanceId,
        defender: i % 2 === 0 ? defenderA : defenderB,
      }));

      const blockerPool = table.creaturesOf(defenderA).slice(0, 3);
      const blocks = blockerPool.map((blocker, i) => ({
        blocker,
        attacker: attackers[i % attackers.length]!.instanceId,
      }));

      const batches: Batch[] = [
        table.setPhase('attackers', me),
        table.declareAttackers(attackers),
        table.setPhase('blockers', me),
        table.declareBlockers(blocks),
        table.setPhase('combatDamage', me),
      ];

      // Unblocked attackers hit their player; blocked ones trade.
      const blockedAttackers = new Set(blocks.map((b) => b.attacker));
      // Annotated, not inferred: inference from the first .map() would fix
      // targetKind to 'player' and reject the card hits pushed below.
      const hits: {
        target: string;
        targetKind: 'card' | 'player';
        amount: number;
        source: InstanceId;
        commander: boolean;
      }[] = attackers
        .filter((a) => !blockedAttackers.has(a.instanceId))
        .map((a) => ({
          target: a.defender,
          targetKind: 'player' as const,
          amount: 3,
          source: a.instanceId,
          commander: false,
        }));
      for (const b of blocks) {
        hits.push({
          target: b.blocker,
          targetKind: 'card' as const,
          amount: 4,
          source: b.attacker,
          commander: false,
        });
      }
      batches.push(table.combatDamage(hits));

      // Two lethal blockers die — the death beat and the flight to the graveyard.
      const lethal = blockerPool.slice(0, 2);
      if (lethal.length > 0) batches.push(table.destroy(lethal));
      batches.push(table.setPhase('endCombat', me));
      return batches;
    },
  },

  {
    id: 'commanderDamage',
    label: 'Commander damage',
    note: 'Violet punch, the matrix cell flashes, 21 total gets lethal styling.',
    gapMs: 400,
    run: ({ table }) => {
      const [me, ...others] = table.playerIds();
      const victim = others[0];
      if (!me || !victim) return [];
      const source = first(table.creaturesOf(me));
      return [
        table.damagePlayer(victim, 7, { commander: true, source: source ?? null }),
        table.damagePlayer(victim, 7, { commander: true, source: source ?? null }),
        table.damagePlayer(victim, 7, { commander: true, source: source ?? null }),
      ];
    },
  },

  {
    id: 'deathChain',
    label: 'Death chain',
    note: '440 ms desaturate-and-drop → 300 ms flight to the graveyard pile.',
    gapMs: 500,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      const doomed = table.creaturesOf(me).slice(0, 3);
      return doomed.map((id) => table.destroy([id]));
    },
  },

  {
    id: 'tokenAndReveal',
    label: 'Token pop + reveal flip',
    note: 'A token has nothing to fly from, so it pops in place.',
    gapMs: 500,
    run: ({ table, pool }) => {
      const me = table.playerIds()[0]!;
      const creature =
        pool.find((c) => /\bCreature\b/.test(c.faces[0]!.typeLine)) ?? pool[0];
      const batches: Batch[] = [];
      if (creature) batches.push(table.createToken(me, creature, 2));
      const hidden = first(table.in('gy', me));
      if (hidden) batches.push(table.reveal(hidden));
      return batches;
    },
  },

  {
    id: 'counters',
    label: 'Counters',
    note: 'A +1/+1 counter makes the CURRENT P/T differ from the printed one.',
    gapMs: 300,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      const target = first(table.creaturesOf(me));
      if (!target) return [];
      return [
        table.counter(target, '+1/+1', 1),
        table.counter(target, '+1/+1', 1),
        table.counter(target, '+1/+1', 2),
      ];
    },
  },

  {
    id: 'manaTaps',
    label: 'Mana: tap lands, fill the pool, empty it',
    note: 'The pool wells are one of the exactly-five places the colours appear.',
    gapMs: 400,
    run: ({ table }) => {
      const me = table.playerIds()[0]!;
      const lands = table
        .in('bf', me)
        .filter((id) => /\bLand\b/.test(table.cardOf(id)?.faces[0]?.typeLine ?? ''))
        .slice(0, 4);
      return [
        table.tap(lands),
        table.addMana(me, 'G', 2),
        table.addMana(me, 'U', 1),
        table.addMana(me, 'C', 1),
        table.emptyManaPool(me),
      ];
    },
  },

  {
    id: 'turnCycle',
    label: 'Full turn cycle',
    note: 'The phase marker slides; priority must never lag the animation queue.',
    gapMs: 220,
    run: ({ table }) => {
      const players = table.playerIds();
      const batches: Batch[] = [];
      for (const p of players) {
        for (const phase of ['untap', 'draw', 'main1', 'attackers', 'main2', 'end'] as const) {
          batches.push(table.setPhase(phase, p));
          batches.push(table.setPriority(p));
        }
      }
      return batches;
    },
  },
];

export const SCENARIOS_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

/** All the instance ids a batch list touches — for a convergence assertion. */
export function touchedInstances(batches: Batch[]): InstanceId[] {
  const ids = new Set<InstanceId>();
  for (const b of batches) {
    for (const e of b.events) {
      if ('instanceId' in e && typeof e.instanceId === 'string') ids.add(e.instanceId);
    }
  }
  return [...ids];
}

/** Whose seats a batch list touches. */
export function touchedPlayers(batches: Batch[]): PlayerId[] {
  const ids = new Set<PlayerId>();
  for (const b of batches) {
    for (const e of b.events) {
      if ('player' in e && typeof e.player === 'string') ids.add(e.player);
    }
  }
  return [...ids];
}

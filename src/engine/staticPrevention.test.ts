// D385 - THE CONTINUOUS PREVENTION EFFECT (CR 615): "Prevent all combat damage that would be
// dealt to this creature." A `PreventionDef` on a battlefield permanent absorbs every matching
// damage entry and spends NOTHING - the other half of D382's one-shot shield, read in the same
// one place (the replacement funnel), which is what makes it reach the hundreds of shipped
// modules that build a `DamageDealt` themselves (D233's measurement).
//
// The defs here are TEST-ONLY scripts on a fixture the harness already deals (Grizzly Bears);
// the printed rows land through the generated wave with `printed()` guards of their own.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { GRIZZLY_BEARS } from '../data/fixtures/engineCards';
import { HUMILITY_SCRIPT } from './testing/cardScripts';
import { PINPOINT_AVALANCHE_SCRIPT } from './scripts/cards/pinpointAvalanche';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

/** A Bears that prints the combat-only form. */
const COMBAT_WALL: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  prevention: [
    {
      abilityId: 'prevent-combat',
      text: 'Prevent all combat damage that would be dealt to this creature.',
      activeZones: ['battlefield'],
      prevents: (_ctx, self, entry, isCombat) => isCombat && entry.target.kind === 'card' && entry.target.id === self,
    },
  ],
};

/** A Bears that prints the any-damage form. */
const ALL_WALL: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  prevention: [
    {
      abilityId: 'prevent-all',
      text: 'Prevent all damage that would be dealt to this creature.',
      activeZones: ['battlefield'],
      prevents: (_ctx, self, entry) => entry.target.kind === 'card' && entry.target.id === self,
    },
  ],
};

const P1 = ['Grizzly Bears', 'Spark Spray', 'Spark Spray', 'Mending Hands', 'Pinpoint Avalanche', 'Humility'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mana(g: Game, symbols: readonly string[]): void {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W', amount: 1 }));
}

/** p1's third-turn main phase, a Bears of p1's and the Cyclops of p2's on the board, every hold on. */
function armed(wall: CardScript, extra: readonly CardScript[] = []): { g: Game; bears: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [P1, ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([wall, PINPOINT_AVALANCHE_SCRIPT, ...extra]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, bears, no };
}

function cast(g: Game, name: string, symbols: readonly string[], targets: readonly { kind: 'card' | 'player'; id: string }[] = []): void {
  const card = put(g, 'p1', name, 'hand');
  mana(g, symbols);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: targets as never }));
  settle(g);
}

/** The Cyclops attacks on p2's turn and the Bears blocks it; the walk ends past combat damage. */
function blockWithBears(g: Game, bears: InstanceId, no: InstanceId): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: bears, attacker: no }] }));
  advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 20_000);
}

describe('D385 - a continuous prevention effect absorbs, and spends nothing', () => {
  test('combat damage to the blocker is prevented, no shield exists to spend, and the log names the ability', () => {
    const { g, bears, no } = armed(COMBAT_WALL);
    expect(g.state.preventionShields).toHaveLength(0);
    blockWithBears(g, bears, no);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(0);
    const ev = g.log.map((e) => e.body).find((b) => b.t === 'DamagePrevented');
    expect(ev?.t === 'DamagePrevented' && ev.spends).toEqual([]);
    expect(ev?.t === 'DamagePrevented' && ev.statics.map((s) => s.abilityId)).toEqual(['prevent-combat']);
    expect(ev?.t === 'DamagePrevented' && ev.statics[0]?.amount).toBe(5);
  });

  test('COMBAT only: a Spark Spray still marks it', () => {
    const { g, bears } = armed(COMBAT_WALL);
    cast(g, 'Spark Spray', ['R'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.damage).toBe(1);
  });

  test("ALL damage: the Spark Spray is absorbed, and Pinpoint Avalanche's unpreventable damage goes through", () => {
    const { g, bears } = armed(ALL_WALL);
    cast(g, 'Spark Spray', ['R'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.damage).toBe(0);
    cast(g, 'Pinpoint Avalanche', ['R', 'R', 'C', 'C', 'C'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('a source that has LOST its abilities prevents nothing (CR 613 layer 6, Humility)', () => {
    const { g, bears, no } = armed(COMBAT_WALL, [HUMILITY_SCRIPT]);
    put(g, 'p1', 'Humility');
    settle(g);
    blockWithBears(g, bears, no);
    // A 1/1 under Humility, blocking a 1/1 Cyclops: the damage lands and it dies.
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the continuous effect is asked FIRST, so a shield on the same recipient is not spent', () => {
    const { g, bears } = armed(ALL_WALL);
    cast(g, 'Mending Hands', ['W'], [{ kind: 'card', id: bears }]);
    expect(g.state.preventionShields[0]?.amount).toBe(4);
    cast(g, 'Spark Spray', ['R'], [{ kind: 'card', id: bears }]);
    expect(g.state.cards[bears]?.damage).toBe(0);
    expect(g.state.preventionShields[0]?.amount).toBe(4);
  });

  test('the game replays: nothing on the state moves for a static, and the log carries it', () => {
    const { g, bears, no } = armed(COMBAT_WALL);
    blockWithBears(g, bears, no);
    expect(stateHash(replay(g.log))).toBe(stateHash(g.state));
  });
});

// D318 — CR 614.12: a permanent's OWN replacement effect that modifies how it
// enters ("enters with two +1/+1 counters") applies from its own abilities as
// it enters, as though it were already on the battlefield. Until D318 the
// funnel offered an event only to the battlefield's permanents, so a
// `ReplacementDef` on the entering card itself never ran — no shipped script
// carried one. Proven here on a TESTING script for Grizzly Bears: cast it,
// and it is a 4/4 with two counters the moment it is on the battlefield; a
// Bears already there is not re-offered its own def when another creature
// enters; the game replays to the same hash.

import { describe, expect, test } from 'vitest';
import { GRIZZLY_BEARS } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import type { CardScript } from './scripts/api';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS_ENTERS_WITH_TWO: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  replacements: [
    {
      abilityId: 'enters-with-two',
      text: 'This creature enters with two +1/+1 counters on it.',
      activeZones: ['battlefield'],
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev) => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 2 }] }],
    },
  ],
};

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([BEARS_ENTERS_WITH_TWO]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Grizzly Bears', 'Grizzly Bears', 'Coral Eel'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([BEARS_ENTERS_WITH_TWO]),
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
  settle(g);
  return { g, bears };
}

describe('CR 614.12 - the entering card is offered its own replacements', () => {
  test('cast, it enters with two +1/+1 counters and is a 4/4 at once', () => {
    const { g, bears } = armed();
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(pt(g, bears)).toEqual([4, 4]);
  });

  test('a Bears already on the battlefield is not re-offered its def when another creature enters', () => {
    const { g, bears } = armed();
    const eel = put(g, 'p1', 'Coral Eel');
    settle(g);
    expect(g.state.cards[eel]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(g.state.cards[eel]?.counters['+1/+1'] ?? 0).toBe(0);
  });

  test('a second copy entering by hand gets its own two counters', () => {
    const { g } = armed();
    const second = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.cards[second]?.counters['+1/+1'] ?? 0).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

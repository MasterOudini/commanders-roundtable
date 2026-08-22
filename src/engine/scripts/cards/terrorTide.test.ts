// `Terror Tide` — the graveyard permanent-card census as -X/-X on EVERY
// creature, mine included. An empty graveyard is a true no-op.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TERROR_TIDE_SCRIPT } from './terrorTide';
import { TERROR_TIDE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TIDE = 'Terror Tide';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan'; // 6/6 — survives a modest tide

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tided(buried: number): { g: Game; small: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TIDE, TITAN], [BEARS]],
    scripts: createRegistry([TERROR_TIDE_SCRIPT]),
  });
  const big = put(g, 'p1', TITAN);
  const small = put(g, 'p2', BEARS);
  settle(g);
  // Bury `buried` cards from the library — a padded deck is basic LANDS, which
  // are permanent cards, so the census counts every one.
  const lib = [...(g.state.zones.library['p1'] ?? [])];
  for (let i = 0; i < buried; i++) {
    const card = lib[i];
    if (!card) throw new Error('the padded library must hold enough cards to bury');
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'graveyard', player: 'p1' } }),
    );
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', TIDE, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, small, big };
}

describe('Terror Tide', () => {
  test('at THREE the 2/2 dies and the 6/6 stands', () => {
    const { g, small, big } = tided(3);
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
  });

  test('an empty graveyard is a true no-op', () => {
    const { g, small, big } = tided(0);
    expect(g.state.cards[small]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TERROR_TIDE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TERROR_TIDE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TERROR_TIDE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = tided(3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

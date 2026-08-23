// `Traverse Eternity` — the greatest mana value among HISTORIC permanents,
// with a bigger nonhistoric permanent proven not to raise it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRAVERSE_ETERNITY_SCRIPT } from './traverseEternity';
import { TRAVERSE_ETERNITY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Traverse Eternity';
const RING = 'Sol Ring'; // Artifact, mv 1 — historic
const MYR = 'Darksteel Myr'; // Artifact Creature, mv 3 — historic
const TITAN = 'Grave Titan'; // Creature, mv 6 — NOT historic

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function traversed(board: readonly string[]): number {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...board], []],
    scripts: createRegistry([TRAVERSE_ETERNITY_SCRIPT]),
  });
  board.forEach((n) => put(g, 'p1', n));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return drawn(g, since);
}

describe('Traverse Eternity', () => {
  test('the greatest HISTORIC mana value is the draw count', () => {
    expect(traversed([RING, MYR])).toBe(3);
  });

  test('a bigger NONHISTORIC permanent does not raise it', () => {
    expect(traversed([RING, TITAN])).toBe(1);
  });

  test('no historic permanents is a true no-op', () => {
    expect(traversed([TITAN])).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRAVERSE_ETERNITY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRAVERSE_ETERNITY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRAVERSE_ETERNITY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SPELL, RING], []],
      scripts: createRegistry([TRAVERSE_ETERNITY_SCRIPT]),
    });
    put(g, 'p1', RING);
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', SPELL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

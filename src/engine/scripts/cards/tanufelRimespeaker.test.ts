// `Tanufel Rimespeaker` — the mana-value filter on MY casts: a four-drop
// pays, a two-drop does not, and an opponent's four-drop pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TANUFEL_RIMESPEAKER_SCRIPT } from './tanufelRimespeaker';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPEAKER = 'Tanufel Rimespeaker';
const BIG = 'Air Elemental'; // {3}{U}{U} — mana value 5
const SMALL = 'Grizzly Bears'; // {1}{G} — mana value 2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drewFor(caster: 'p1' | 'p2', spell: string): number {
  const g = startedGame({
    players: 2,
    decks: [[SPEAKER, BIG, SMALL], [BIG, SMALL]],
    scripts: createRegistry([TANUFEL_RIMESPEAKER_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', SPEAKER);
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === caster &&
      s.priority.player === caster &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    40_000,
  );
  const card = put(g, caster, spell, 'hand');
  for (const symbol of ['U', 'G', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: caster, target: caster, symbol, amount: 5 }));
  }
  const before = (g.state.zones.hand.p1 ?? []).length;
  must(g.submit({ t: 'CastSpell', player: caster, card }));
  settle(g);
  const after = (g.state.zones.hand.p1 ?? []).length;
  // p1 casting loses the card from their own hand; p2 casting does not.
  return caster === 'p1' ? after - before + 1 : after - before;
}

describe('Tanufel Rimespeaker', () => {
  test('MY mana-value-5 cast draws a card', () => {
    expect(drewFor('p1', BIG)).toBe(1);
  });

  test('MY mana-value-2 cast draws nothing', () => {
    expect(drewFor('p1', SMALL)).toBe(0);
  });

  test("an OPPONENT's big cast draws nothing", () => {
    expect(drewFor('p2', BIG)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SPEAKER, BIG], []],
      scripts: createRegistry([TANUFEL_RIMESPEAKER_SCRIPT]),
    });
    holdEverywhere(g);
    put(g, 'p1', SPEAKER);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
      40_000,
    );
    const card = put(g, 'p1', BIG, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Desolation Twin` — CASTING it brings the 10/10 Eldrazi; entering any
// other way brings nothing, because the trigger is on the cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DESOLATION_TWIN_SCRIPT } from './desolationTwin';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TWIN = 'Desolation Twin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function eldrazi(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Eldrazi').length;
}

function board(): Game {
  return startedGame({
    players: 2,
    decks: [[TWIN], []],
    scripts: createRegistry([DESOLATION_TWIN_SCRIPT]),
  });
}

describe('Desolation Twin', () => {
  test('casting it creates the 10/10 Eldrazi, and both end up on the battlefield', () => {
    const g = board();
    const twin = put(g, 'p1', TWIN, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 10 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin }));
    settle(g);
    expect(g.state.cards[twin]?.zone.kind).toBe('battlefield');
    expect(eldrazi(g)).toBe(1);
  });

  test('entering WITHOUT a cast brings nothing — the trigger is on the spell', () => {
    const g = board();
    put(g, 'p1', TWIN);
    settle(g);
    expect(eldrazi(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const twin = put(g, 'p1', TWIN, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 10 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

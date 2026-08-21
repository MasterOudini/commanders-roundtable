// `Quandrix Campus` — the green-blue campus scries for four.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { QUANDRIX_CAMPUS_SCRIPT } from './quandrixCampus';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function schooled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Quandrix Campus'], []],
    scripts: createRegistry([QUANDRIX_CAMPUS_SCRIPT]),
  });
  const campus = put(g, 'p1', 'Quandrix Campus');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [campus], tapped: false }));
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: campus, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return g;
}

describe('Quandrix Campus', () => {
  test('the paid ability raises the scry and the answer bottoms the card', () => {
    const g = schooled();
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed);
  });

  test('replays to the same hash', () => {
    const g = schooled();
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

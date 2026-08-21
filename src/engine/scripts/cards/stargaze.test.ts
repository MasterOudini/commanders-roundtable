// `Stargaze` — X=2: look at four, two to hand, two to the graveyard, lose
// 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STARGAZE_SCRIPT } from './stargaze';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gazed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Stargaze'], []],
    scripts: createRegistry([STARGAZE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stargaze', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  if (revealed.length !== 4) throw new Error(`expected 4 revealed, got ${revealed.length}`);
  must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: revealed.slice(0, 2) }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return { g, before };
}

describe('Stargaze', () => {
  test('two to hand, two to the graveyard, two life gone', () => {
    const { g, before } = gazed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1 + 2);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(3); // Stargaze itself + the 2 declined
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = gazed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

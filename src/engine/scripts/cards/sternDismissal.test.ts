// `Stern Dismissal` — an opponent's enchantment goes home; my own creature
// is refused at the aim (the probed opponent restriction).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STERN_DISMISSAL_SCRIPT } from './sternDismissal';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dismissed(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Stern Dismissal', 'Grizzly Bears'], ['Spirited Companion']],
    scripts: createRegistry([STERN_DISMISSAL_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Spirited Companion');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stern Dismissal', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const refused = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: mine }],
  });
  if (refused.ok) throw new Error('my own creature must be refused — an opponent controls');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Stern Dismissal', () => {
  test("the enchantment creature returns to its owner's hand", () => {
    const { g, theirs } = dismissed();
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g } = dismissed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

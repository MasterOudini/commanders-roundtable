// `Soul's Majesty` — draws equal to my Bears' power; an opponent's creature
// is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULS_MAJESTY_SCRIPT } from './soulsMajesty';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function majestied(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [["Soul's Majesty", 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([SOULS_MAJESTY_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Soul's Majesty", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 5 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const refused = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: theirs }],
  });
  if (refused.ok) throw new Error("an opponent's creature must be refused — you control");
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
  settle(g);
  return { g, before };
}

describe("Soul's Majesty", () => {
  test('draws two for the 2-power Bears; the spell itself left the hand', () => {
    const { g, before } = majestied();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1 + 2);
  });

  test('replays to the same hash', () => {
    const { g } = majestied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

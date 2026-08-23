// `Vedalken Mastermind` — my own permanent home, an opponent's refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VEDALKEN_MASTERMIND_SCRIPT } from './vedalkenMastermind';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MASTERMIND = 'Vedalken Mastermind';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MASTERMIND, BEARS], [BEARS]],
    scripts: createRegistry([VEDALKEN_MASTERMIND_SCRIPT]),
  });
  const mastermind = put(g, 'p1', MASTERMIND);
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mastermind, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mine, theirs };
}

describe('Vedalken Mastermind', () => {
  test('my own creature goes to my hand', () => {
    const { g, mine } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[mine]?.zone.player).toBe('p1');
  });

  test("an OPPONENT's permanent is refused — the clause says you control", () => {
    const { g, theirs } = armed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, mine } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Stormscape Apprentice` — {W} and the tap tap a creature; {B} and the tap
// drain a player for 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STORMSCAPE_APPRENTICE_SCRIPT } from './stormscapeApprentice';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const APPRENTICE = 'Stormscape Apprentice';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; apprentice: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[APPRENTICE], [BEARS]],
    scripts: createRegistry([STORMSCAPE_APPRENTICE_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const apprentice = put(g, 'p1', APPRENTICE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, apprentice, theirs };
}

describe('Stormscape Apprentice', () => {
  test("{W}, {T}: the opponent's creature is tapped", () => {
    const { g, apprentice, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    expect(g.state.cards[apprentice]?.tapped).toBe(true);
  });

  test('{B}, {T}: the opponent loses 1 life', () => {
    const { g, apprentice } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, apprentice } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

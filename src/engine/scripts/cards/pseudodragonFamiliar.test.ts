// `Pseudodragon Familiar` — three mana put a Bears in the air until
// cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PSEUDODRAGON_FAMILIAR_SCRIPT } from './pseudodragonFamiliar';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function familiar(): { g: Game; bears: InstanceId; turn: number } {
  const g = startedGame({
    players: 2,
    decks: [['Pseudodragon Familiar', 'Grizzly Bears'], []],
    scripts: createRegistry([PSEUDODRAGON_FAMILIAR_SCRIPT]),
  });
  const dragon = put(g, 'p1', 'Pseudodragon Familiar');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: dragon,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, bears, turn: g.state.turn.turnNumber };
}

describe('Pseudodragon Familiar', () => {
  test('the Bears flies until end of turn', () => {
    const { g, bears, turn } = familiar();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, turn } = familiar();
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

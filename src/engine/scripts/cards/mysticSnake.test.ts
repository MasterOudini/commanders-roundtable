// `Mystic Snake` — enters while a spell is on the stack, asks, and
// counters it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MYSTIC_SNAKE_SCRIPT } from './mysticSnake';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function snaked(): { g: Game; snake: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mystic Snake'], ['Grizzly Bears']],
    scripts: createRegistry([MYSTIC_SNAKE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  // p2 casts a Bears on THEIR turn; p1 answers with the Snake mid-stack.
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack[g.state.stack.length - 1]?.id;
  if (!stackId) throw new Error('no spell on the stack');
  const snake = put(g, 'p1', 'Mystic Snake');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, snake, bears };
}

describe('Mystic Snake', () => {
  test('the entry counters the spell on the stack', () => {
    const { g, snake, bears } = snaked();
    expect(g.state.cards[snake]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = snaked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

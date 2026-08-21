// `Spreading Rot` — the land dies and its controller pays 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPREADING_ROT_SCRIPT } from './spreadingRot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rotted(): { g: Game; swamp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spreading Rot'], ['Swamp']],
    scripts: createRegistry([SPREADING_ROT_SCRIPT]),
  });
  const swamp = put(g, 'p2', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Spreading Rot', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: swamp }] }));
  settle(g);
  return { g, swamp };
}

describe('Spreading Rot', () => {
  test('the land dies and p2 loses 2', () => {
    const { g, swamp } = rotted();
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = rotted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

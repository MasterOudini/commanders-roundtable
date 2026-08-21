// `Savage Smash` — the pumped 4/4 kills the 1/3 and shrugs off the bite.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAVAGE_SMASH_SCRIPT } from './savageSmash';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function smashed(): { g: Game; bears: InstanceId; crab: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Savage Smash', 'Grizzly Bears'],
      ['Riptide Crab'],
    ],
    scripts: createRegistry([SAVAGE_SMASH_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const crab = put(g, 'p2', 'Riptide Crab');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Savage Smash', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'card', id: crab },
      ],
    }),
  );
  settle(g);
  return { g, bears, crab };
}

describe('Savage Smash', () => {
  test('the pumped 4/4 kills the 1/3 and survives the bite back', () => {
    const { g, bears, crab } = smashed();
    expect(g.state.cards[crab]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = smashed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

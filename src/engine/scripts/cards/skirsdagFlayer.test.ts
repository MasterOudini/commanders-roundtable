// `Skirsdag Flayer` — the Flayer is ITSELF the Human it sacrifices
// (CR 113.7a): the cost eats it and the destroy still resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKIRSDAG_FLAYER_SCRIPT } from './skirsdagFlayer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flayed(): { g: Game; flayer: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skirsdag Flayer'], ['Grizzly Bears']],
    scripts: createRegistry([SKIRSDAG_FLAYER_SCRIPT]),
  });
  const flayer = put(g, 'p1', 'Skirsdag Flayer');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: flayer,
      abilityIndex: 0,
      sacrifice: flayer,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, flayer, bears };
}

describe('Skirsdag Flayer', () => {
  test('paying with itself still destroys the target', () => {
    const { g, flayer, bears } = flayed();
    expect(g.state.cards[flayer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = flayed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

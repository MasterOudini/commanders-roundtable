// `Foundry of the Consuls` — the land spends itself for two DISTINCT
// Thopters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FOUNDRY_OF_THE_CONSULS_SCRIPT } from './foundryOfTheConsuls';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FOUNDRY = 'Foundry of the Consuls';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; foundry: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FOUNDRY], []],
    scripts: createRegistry([FOUNDRY_OF_THE_CONSULS_SCRIPT]),
  });
  const foundry = put(g, 'p1', FOUNDRY);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  return { g, foundry };
}

describe('Foundry of the Consuls', () => {
  test('the sacrifice makes two DISTINCT Thopters', () => {
    const { g, foundry } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: foundry, abilityIndex: 1, targets: [] }));
    expect(g.state.cards[foundry]?.zone.kind).toBe('graveyard');
    settle(g);
    const tokens = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter');
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, foundry } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: foundry, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

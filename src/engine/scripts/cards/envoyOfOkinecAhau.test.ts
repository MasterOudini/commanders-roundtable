// `Envoy of Okinec Ahau` — twice the mana, twice the Gnome; the Envoy
// stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ENVOY_OF_OKINEC_AHAU_SCRIPT } from './envoyOfOkinecAhau';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ENVOY = 'Envoy of Okinec Ahau';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gnomes(g: Game): InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Gnome');
}

function game(): { g: Game; envoy: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ENVOY], []],
    scripts: createRegistry([ENVOY_OF_OKINEC_AHAU_SCRIPT]),
  });
  const envoy = put(g, 'p1', ENVOY);
  settle(g);
  return { g, envoy };
}

describe('Envoy of Okinec Ahau', () => {
  test('two activations make two DISTINCT Gnomes, no tap anywhere', () => {
    const { g, envoy } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: envoy, abilityIndex: 0, targets: [] }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: envoy, abilityIndex: 0, targets: [] }));
    settle(g);
    const tokens = gnomes(g);
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
    expect(g.state.cards[envoy]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, envoy } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: envoy, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

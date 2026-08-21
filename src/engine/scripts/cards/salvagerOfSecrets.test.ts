// `Salvager of Secrets` — entering returns the buried Bolt to hand; the
// aim refuses a creature card (cardTypes ENFORCED).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SALVAGER_OF_SECRETS_SCRIPT } from './salvagerOfSecrets';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function salvaged(): { g: Game; bolt: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Salvager of Secrets', 'Lightning Bolt', 'Grizzly Bears'], []],
    scripts: createRegistry([SALVAGER_OF_SECRETS_SCRIPT]),
  });
  const bolt = put(g, 'p1', 'Lightning Bolt', 'graveyard');
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Salvager of Secrets');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  return { g, bolt, bears };
}

describe('Salvager of Secrets', () => {
  test('the buried creature is refused; the Bolt comes to hand', () => {
    const { g, bolt, bears } = salvaged();
    const refused = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: bears }],
    });
    expect(refused.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
    settle(g);
    expect(g.state.cards[bolt]?.zone.kind).toBe('hand');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bolt } = salvaged();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

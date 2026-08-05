// `Caustic Caterpillar` — the {1}{G}+self-sacrifice destroy; no {T}.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CAUSTIC_CATERPILLAR_SCRIPT } from './causticCaterpillar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CATERPILLAR = 'Caustic Caterpillar';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; bug: InstanceId; mantra: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CATERPILLAR], ["Ajani's Mantra"]],
    scripts: createRegistry([CAUSTIC_CATERPILLAR_SCRIPT]),
  });
  const mantra = put(g, 'p2', "Ajani's Mantra");
  const bug = put(g, 'p1', CATERPILLAR);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, bug, mantra };
}

describe('Caustic Caterpillar', () => {
  test('destroys the targeted enchantment, with the Caterpillar spent', () => {
    const { g, bug, mantra } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: bug,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: mantra }],
      }),
    );
    settle(g);
    expect(g.state.cards[mantra]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bug]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bug, mantra } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: bug,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: mantra }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

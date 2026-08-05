// `Cathar Commando` — the {1}+self-sacrifice destroy; no {T}, so no
// sickness wait.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CATHAR_COMMANDO_SCRIPT } from './catharCommando';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const COMMANDO = 'Cathar Commando';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; commando: InstanceId; cup: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[COMMANDO], ['Braidwood Cup']],
    scripts: createRegistry([CATHAR_COMMANDO_SCRIPT]),
  });
  const cup = put(g, 'p2', 'Braidwood Cup');
  const commando = put(g, 'p1', COMMANDO);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, commando, cup };
}

describe('Cathar Commando', () => {
  test('destroys the targeted artifact, with the Commando spent', () => {
    const { g, commando, cup } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: commando,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: cup }],
      }),
    );
    settle(g);
    expect(g.state.cards[cup]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[commando]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, commando, cup } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: commando,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: cup }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Plagued Rusalka` — the chooser pays with a Bears, or with itself
// (CR 113.7a), and the 1/1 dies either way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLAGUED_RUSALKA_SCRIPT } from './plaguedRusalka';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function staged(): { g: Game; rusalka: InstanceId; bears: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Plagued Rusalka', 'Grizzly Bears'], ['Aysen Bureaucrats']],
    scripts: createRegistry([PLAGUED_RUSALKA_SCRIPT]),
  });
  const rusalka = put(g, 'p1', 'Plagued Rusalka');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const victim = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, rusalka, bears, victim };
}

describe('Plagued Rusalka', () => {
  test('the Bears pays and the Bureaucrats dies at -1/-1', () => {
    const { g, rusalka, bears, victim } = staged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: rusalka,
        abilityIndex: 0,
        sacrifice: bears,
        targets: [{ kind: 'card', id: victim }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[rusalka]?.zone.kind).toBe('battlefield');
  });

  test('it may pay with ITSELF and the ability still resolves (CR 113.7a)', () => {
    const { g, rusalka, victim } = staged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: rusalka,
        abilityIndex: 0,
        sacrifice: rusalka,
        targets: [{ kind: 'card', id: victim }],
      }),
    );
    settle(g);
    expect(g.state.cards[rusalka]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, rusalka, bears, victim } = staged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: rusalka,
        abilityIndex: 0,
        sacrifice: bears,
        targets: [{ kind: 'card', id: victim }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

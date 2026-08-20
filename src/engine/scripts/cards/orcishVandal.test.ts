// `Orcish Vandal` — the twin proven on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORCISH_VANDAL_SCRIPT } from './orcishVandal';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function vandalized(): { g: Game; vandal: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Orcish Vandal', 'Sol Ring'], []],
    scripts: createRegistry([ORCISH_VANDAL_SCRIPT]),
  });
  const vandal = put(g, 'p1', 'Orcish Vandal');
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, vandal, ring };
}

describe('Orcish Vandal', () => {
  test('the Ring pays and the 2 lands', () => {
    const { g, vandal, ring } = vandalized();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: vandal,
        abilityIndex: 0,
        sacrifice: ring,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g, vandal, ring } = vandalized();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: vandal,
        abilityIndex: 0,
        sacrifice: ring,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

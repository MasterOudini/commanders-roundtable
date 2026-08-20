// `Orcish Mechanics` — the artifact pays and the 2 lands; the ability line
// is Orcish Vandal's twin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORCISH_MECHANICS_SCRIPT } from './orcishMechanics';
import { ORCISH_MECHANICS, ORCISH_VANDAL } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mechanicked(): { g: Game; mech: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Orcish Mechanics', 'Sol Ring'], []],
    scripts: createRegistry([ORCISH_MECHANICS_SCRIPT]),
  });
  const mech = put(g, 'p1', 'Orcish Mechanics');
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, mech, ring };
}

describe('Orcish Mechanics', () => {
  test('carries the family text verbatim', () => {
    expect(ORCISH_MECHANICS.faces[0]?.oracleText).toBe(ORCISH_VANDAL.faces[0]?.oracleText);
  });

  test('the Ring pays and the 2 lands', () => {
    const { g, mech, ring } = mechanicked();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mech,
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
    const { g, mech, ring } = mechanicked();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mech,
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

// `Thornwind Faeries` — the {T} ping at either kind of target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THORNWIND_FAERIES_SCRIPT } from './thornwindFaeries';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FAERIES = 'Thornwind Faeries';
const ONE_ONE = 'Dryad Arbor'; // a 1/1 — one point kills it

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; faeries: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FAERIES], [ONE_ONE]],
    scripts: createRegistry([THORNWIND_FAERIES_SCRIPT]),
  });
  const faeries = put(g, 'p1', FAERIES);
  const victim = put(g, 'p2', ONE_ONE);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  return { g, faeries, victim };
}

describe('Thornwind Faeries', () => {
  test('a creature takes 1 and the 1/1 dies through the SBA', () => {
    const { g, faeries, victim } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: faeries, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
    settle(g);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[faeries]?.tapped).toBe(true);
  });

  test('a PLAYER is the other arm of "any target"', () => {
    const { g, faeries } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: faeries, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, faeries } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: faeries, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

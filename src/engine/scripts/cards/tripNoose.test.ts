// `Trip Noose` — the {2}, {T} tap.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TRIP_NOOSE_SCRIPT } from './tripNoose';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const NOOSE = 'Trip Noose';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function noosed(): { g: Game; noose: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[NOOSE], [BEARS]],
    scripts: createRegistry([TRIP_NOOSE_SCRIPT]),
  });
  const noose = put(g, 'p1', NOOSE);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: noose, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, noose, victim };
}

describe('Trip Noose', () => {
  test("an opponent's creature is turned, and the Noose turns to pay for it", () => {
    const { g, noose, victim } = noosed();
    expect(g.state.cards[victim]?.tapped).toBe(true);
    expect(g.state.cards[noose]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = noosed();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

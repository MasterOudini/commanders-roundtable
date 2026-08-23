// `Viridian Corrupter` — the ETB artifact destroy, with an indestructible artifact
// proving the check.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIRIDIAN_CORRUPTER_SCRIPT } from './viridianCorrupter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Viridian Corrupter';
const RING = 'Sol Ring';
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landed(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD], [victimName]],
    scripts: createRegistry([VIRIDIAN_CORRUPTER_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  put(g, 'p1', CARD);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Viridian Corrupter', () => {
  test("an opponent's artifact dies on the entry", () => {
    const { g, victim } = landed(RING);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives', () => {
    const { g, victim } = landed(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = landed(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

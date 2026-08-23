// `Uktabi Orangutan` — the ETB artifact destroy.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UKTABI_ORANGUTAN_SCRIPT } from './uktabiOrangutan';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const APE = 'Uktabi Orangutan';
const RING = 'Sol Ring';
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landed(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[APE], [victimName]],
    scripts: createRegistry([UKTABI_ORANGUTAN_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  put(g, 'p1', APE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Uktabi Orangutan', () => {
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

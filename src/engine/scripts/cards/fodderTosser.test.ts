// `Fodder Tosser` — the tap and a discarded card deal 2 to the opponent;
// an artifact, so it works the turn it enters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FODDER_TOSSER_SCRIPT } from './fodderTosser';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TOSSER = 'Fodder Tosser';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; tosser: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TOSSER], []],
    scripts: createRegistry([FODDER_TOSSER_SCRIPT]),
  });
  const tosser = put(g, 'p1', TOSSER);
  settle(g);
  return { g, tosser };
}

describe('Fodder Tosser', () => {
  test('{T}, discard a card: 2 damage to the opponent', () => {
    const { g, tosser } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tosser, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[tosser]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, tosser } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tosser, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

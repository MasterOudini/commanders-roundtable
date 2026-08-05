// `Barbarian Riftcutter` — the targeted self-sacrifice destroy, with its own
// indestructible break carried by Darksteel Citadel.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BARBARIAN_RIFTCUTTER_SCRIPT } from './barbarianRiftcutter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RIFTCUTTER = 'Barbarian Riftcutter';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(landName: string): { g: Game; cutter: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RIFTCUTTER], [landName]],
    scripts: createRegistry([BARBARIAN_RIFTCUTTER_SCRIPT]),
  });
  const land = put(g, 'p2', landName);
  const cutter = put(g, 'p1', RIFTCUTTER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  return { g, cutter, land };
}

describe('Barbarian Riftcutter', () => {
  test('destroys the targeted land, with the Riftcutter spent as part of the cost', () => {
    const { g, cutter, land } = game('Mountain');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: cutter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: land }],
      }),
    );
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[cutter]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE land survives, and the cost stays paid', () => {
    const { g, cutter, land } = game('Darksteel Citadel');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: cutter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: land }],
      }),
    );
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[cutter]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, cutter, land } = game('Mountain');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: cutter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: land }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

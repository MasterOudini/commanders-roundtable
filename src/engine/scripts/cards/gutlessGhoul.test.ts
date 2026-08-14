// `Gutless Ghoul` — the chooser paying with ITSELF (CR 113.7a) for 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GUTLESS_GHOUL_SCRIPT } from './gutlessGhoul';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GHOUL = 'Gutless Ghoul';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; ghoul: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GHOUL], []],
    scripts: createRegistry([GUTLESS_GHOUL_SCRIPT]),
  });
  const ghoul = put(g, 'p1', GHOUL);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, ghoul };
}

describe('Gutless Ghoul', () => {
  test('sacrifices ITSELF and the life still arrives', () => {
    const { g, ghoul } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: ghoul, abilityIndex: 0, sacrifice: ghoul }),
    );
    settle(g);
    expect(g.state.cards[ghoul]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g, ghoul } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: ghoul, abilityIndex: 0, sacrifice: ghoul }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

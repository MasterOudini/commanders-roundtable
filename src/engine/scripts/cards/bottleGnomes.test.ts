// `Bottle Gnomes` — the mana-free self-sacrifice gain, no sickness gate.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOTTLE_GNOMES_SCRIPT } from './bottleGnomes';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GNOMES = 'Bottle Gnomes';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; gnomes: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GNOMES], []],
    scripts: createRegistry([BOTTLE_GNOMES_SCRIPT]),
  });
  const gnomes = put(g, 'p1', GNOMES);
  settle(g);
  return { g, gnomes };
}

describe('Bottle Gnomes', () => {
  test('gains 3 life with the Gnomes spent as the cost', () => {
    const { g, gnomes } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: gnomes, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[gnomes]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, gnomes } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: gnomes, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

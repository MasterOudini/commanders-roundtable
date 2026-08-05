// `Brindle Boar` — the self-sacrifice gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRINDLE_BOAR_SCRIPT } from './brindleBoar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BOAR = 'Brindle Boar';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; boar: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BOAR], []],
    scripts: createRegistry([BRINDLE_BOAR_SCRIPT]),
  });
  const boar = put(g, 'p1', BOAR);
  settle(g);
  return { g, boar };
}

describe('Brindle Boar', () => {
  test('gains 4 life with the Boar spent as the cost', () => {
    const { g, boar } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: boar, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(44);
    expect(g.state.cards[boar]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, boar } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: boar, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

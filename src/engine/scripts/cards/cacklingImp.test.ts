// `Cackling Imp` — the tap-drain, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CACKLING_IMP_SCRIPT } from './cacklingImp';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const IMP = 'Cackling Imp';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; imp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[IMP], []],
    scripts: createRegistry([CACKLING_IMP_SCRIPT]),
  });
  const imp = put(g, 'p1', IMP);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, imp };
}

describe('Cackling Imp', () => {
  test('the targeted player loses 1 life, the Imp turned by the cost', () => {
    const { g, imp } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: imp,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[imp]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, imp } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: imp,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

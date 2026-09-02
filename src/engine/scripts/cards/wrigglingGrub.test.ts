// `Wriggling Grub` — dying leaves two DISTINCT Worms.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WRIGGLING_GRUB_SCRIPT } from './wrigglingGrub';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GRUB = 'Wriggling Grub';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; grub: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GRUB], []],
    scripts: createRegistry([WRIGGLING_GRUB_SCRIPT]),
  });
  const grub = put(g, 'p1', GRUB);
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: grub, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return { g, grub };
}

describe('Wriggling Grub', () => {
  test('two DISTINCT Worms, mine', () => {
    const { g, grub } = died();
    expect(g.state.cards[grub]?.zone.kind).toBe('graveyard');
    const worms = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Worm');
    expect(worms).toHaveLength(2);
    expect(new Set(worms).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

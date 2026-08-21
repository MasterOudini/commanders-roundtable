// `Symbiotic Elf` — the same printed shape at two, the smallest of the
// three that landed together.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYMBIOTIC_ELF_SCRIPT } from './symbioticElf';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ELF = 'Symbiotic Elf';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ELF], []],
    scripts: createRegistry([SYMBIOTIC_ELF_SCRIPT]),
  });
  const elf = put(g, 'p1', ELF);
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: elf, to: { kind: 'graveyard', player: 'p1' } }),
  );
  settle(g);
  return g;
}

describe('Symbiotic Elf', () => {
  test('dying creates TWO distinct 1/1 Insects', () => {
    const g = killed();
    const insects = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect');
    expect(insects).toHaveLength(2);
    expect(new Set(insects).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

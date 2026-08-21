// `Psionic Blast` — four out, two back at the caster.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PSIONIC_BLAST_SCRIPT } from './psionicBlast';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blasted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Psionic Blast'], []],
    scripts: createRegistry([PSIONIC_BLAST_SCRIPT]),
  });
  settle(g);
  const spell = put(g, 'p1', 'Psionic Blast', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return g;
}

describe('Psionic Blast', () => {
  test('the target takes 4 and the caster takes 2', () => {
    const g = blasted();
    expect(g.state.players['p2']?.life).toBe(36);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const g = blasted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

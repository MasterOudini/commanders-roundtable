// `Radiating Lightning` — three at the player, one at each of their
// creatures, nothing at mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RADIATING_LIGHTNING_SCRIPT } from './radiatingLightning';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function radiated(): { g: Game; theirs: string; mine: string } {
  const g = startedGame({
    players: 2,
    decks: [['Radiating Lightning', 'Aysen Bureaucrats'], ['Aysen Bureaucrats']],
    scripts: createRegistry([RADIATING_LIGHTNING_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Aysen Bureaucrats');
  const mine = put(g, 'p1', 'Aysen Bureaucrats');
  settle(g);
  const spell = put(g, 'p1', 'Radiating Lightning', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return { g, theirs, mine };
}

describe('Radiating Lightning', () => {
  test('p2 takes 3, their 1/1 dies, my 1/1 stands', () => {
    const { g, theirs, mine } = radiated();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = radiated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

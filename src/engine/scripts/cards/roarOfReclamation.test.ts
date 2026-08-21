// `Roar of Reclamation` — each player's artifacts rise under their OWN
// control; a creature card stays buried.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROAR_OF_RECLAMATION_SCRIPT } from './roarOfReclamation';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function roared(): { g: Game; mine: InstanceId; theirs: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Roar of Reclamation', 'Sol Ring', 'Grizzly Bears'],
      ['Sol Ring'],
    ],
    scripts: createRegistry([ROAR_OF_RECLAMATION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Sol Ring', 'graveyard');
  const theirs = put(g, 'p2', 'Sol Ring', 'graveyard');
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Roar of Reclamation', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears };
}

describe('Roar of Reclamation', () => {
  test('each Sol Ring rises under its owner; the Bears stay buried', () => {
    const { g, mine, theirs, bears } = roared();
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.controller).toBe('p1');
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[theirs]?.controller).toBe('p2');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = roared();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

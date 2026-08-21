// `Rain of Daggers` — their board dies, mine stands, and I pay 2 a head
// for what actually died.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAIN_OF_DAGGERS_SCRIPT } from './rainOfDaggers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function daggered(): { g: Game; a: string; b: string; myrs: string; mine: string } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rain of Daggers', 'Grizzly Bears'],
      ['Grizzly Bears', 'Colossal Dreadmaw', 'Darksteel Myr'],
    ],
    scripts: createRegistry([RAIN_OF_DAGGERS_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Colossal Dreadmaw');
  const myrs = put(g, 'p2', 'Darksteel Myr');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Rain of Daggers', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return { g, a, b, myrs, mine };
}

describe('Rain of Daggers', () => {
  test('two of theirs die (4 life from me); the indestructible Myr and my Bears stand', () => {
    const { g, a, b, myrs, mine } = daggered();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myrs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(36);
  });

  test('replays to the same hash', () => {
    const { g } = daggered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

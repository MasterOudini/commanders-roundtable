// `Prodigal Pyromancer` — one point, either kind of target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRODIGAL_PYROMANCER_SCRIPT } from './prodigalPyromancer';
import { PRODIGAL_PYROMANCER, PRODIGAL_SORCERER } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; tim: string; victim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Prodigal Pyromancer'], ['Aysen Bureaucrats']],
    scripts: createRegistry([PRODIGAL_PYROMANCER_SCRIPT]),
  });
  const tim = put(g, 'p1', 'Prodigal Pyromancer');
  const victim = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, tim, victim };
}

describe('Prodigal Pyromancer', () => {
  test('shares its printed text with Prodigal Sorcerer', () => {
    expect(PRODIGAL_PYROMANCER.faces[0]?.oracleText).toBe(PRODIGAL_SORCERER.faces[0]?.oracleText);
  });

  test('pings a 1/1 dead', () => {
    const { g, tim, victim } = ready();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: tim,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: victim }],
      }),
    );
    settle(g);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('pings a player and replays to the same hash', () => {
    const { g, tim } = ready();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: tim,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

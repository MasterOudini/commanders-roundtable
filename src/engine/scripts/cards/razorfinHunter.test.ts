// `Razorfin Hunter` — the third Tim, proven on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAZORFIN_HUNTER_SCRIPT } from './razorfinHunter';
import { RAZORFIN_HUNTER, PRODIGAL_SORCERER } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; tim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Razorfin Hunter'], []],
    scripts: createRegistry([RAZORFIN_HUNTER_SCRIPT]),
  });
  const tim = put(g, 'p1', 'Razorfin Hunter');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, tim };
}

describe('Razorfin Hunter', () => {
  test('shares its printed text with Prodigal Sorcerer', () => {
    expect(RAZORFIN_HUNTER.faces[0]?.oracleText).toBe(PRODIGAL_SORCERER.faces[0]?.oracleText);
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

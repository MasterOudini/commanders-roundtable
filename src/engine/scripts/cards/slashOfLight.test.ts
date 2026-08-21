// `Slash of Light` — the damage is creatures + Equipment: two Bears and a
// Boots make 3, enough to kill the opposing 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SLASH_OF_LIGHT_SCRIPT } from './slashOfLight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slashed(): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Slash of Light', 'Grizzly Bears', 'Grizzly Bears', 'Swiftfoot Boots'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SLASH_OF_LIGHT_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Swiftfoot Boots');
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Slash of Light', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Slash of Light', () => {
  test('two creatures plus one Equipment deal 3 — the 2/2 dies', () => {
    const { g, victim } = slashed();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = slashed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

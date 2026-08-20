// `Pharika's Cure` — two damage in, two life back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHARIKAS_CURE_SCRIPT } from './pharikasCure';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cured(): { g: Game; victim: string } {
  const g = startedGame({
    players: 2,
    decks: [["Pharika's Cure"], ['Grizzly Bears']],
    scripts: createRegistry([PHARIKAS_CURE_SCRIPT]),
  });
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', "Pharika's Cure", 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: victim }] }),
  );
  settle(g);
  return { g, victim };
}

describe('Pharika s Cure', () => {
  test('kills the 2/2 and gains 2', () => {
    const { g, victim } = cured();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g } = cured();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

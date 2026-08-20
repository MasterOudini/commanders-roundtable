// `Part the Veil` — bounces YOUR creatures only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PART_THE_VEIL_SCRIPT } from './partTheVeil';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function veiled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Part the Veil', 'Grizzly Bears', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([PART_THE_VEIL_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Colossal Dreadmaw');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const veil = put(g, 'p1', 'Part the Veil', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['U', 'C', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: veil }));
  settle(g);
  return g;
}

describe('Part the Veil', () => {
  test('returns only its controller creatures to hand', () => {
    const g = veiled();
    const names = (g.state.zones.hand['p1'] ?? []).map((id) => nameOf(g, id));
    expect(names).toContain('Grizzly Bears');
    expect(names).toContain('Colossal Dreadmaw');
    const p2Field = g.state.zones.battlefield.filter(
      (id) => g.state.cards[id]?.controller === 'p2' && nameOf(g, id) === 'Grizzly Bears',
    );
    expect(p2Field).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = veiled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Peppersmoke` — the debuff always lands; the draw needs a Faerie.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PEPPERSMOKE_SCRIPT } from './peppersmoke';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function smoked(withFaerie: boolean): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [['Peppersmoke', 'Faerie Duelist'], ['Grizzly Bears']],
    scripts: createRegistry([PEPPERSMOKE_SCRIPT]),
  });
  if (withFaerie) put(g, 'p1', 'Faerie Duelist');
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Peppersmoke', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: victim }] }),
  );
  settle(g);
  const derived = derive(g.state, ORACLE, g.deps.scripts, victim);
  expect(derived.power).toBe(1);
  expect(derived.toughness).toBe(1);
  return { g, drew: (g.state.zones.hand['p1'] ?? []).length - (before - 1) };
}

describe('Peppersmoke', () => {
  test('with a Faerie the debuff comes with a card', () => {
    const { drew } = smoked(true);
    expect(drew).toBe(1);
  });

  test('without a Faerie it only shrinks', () => {
    const { drew } = smoked(false);
    expect(drew).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = smoked(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

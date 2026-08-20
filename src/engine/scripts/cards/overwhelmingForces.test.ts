// `Overwhelming Forces` — the target opponent's two die and I draw two;
// MY creature stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { OVERWHELMING_FORCES_SCRIPT } from './overwhelmingForces';
import { OVERWHELMING_FORCES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function forced(): { g: Game; mine: InstanceId; a: InstanceId; b: InstanceId; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Overwhelming Forces', 'Grizzly Bears'],
      ['Grizzly Bears', 'Aysen Bureaucrats'],
    ],
    scripts: createRegistry([OVERWHELMING_FORCES_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Overwhelming Forces', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  const mid = (g.state.zones.hand['p1'] ?? []).length - 1; // the spell leaves on cast
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, mine, a, b, mid };
}

describe('Overwhelming Forces', () => {
  test("the opponent's two die, I draw two, my creature stands", () => {
    const { g, mine, a, b, mid } = forced();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = OVERWHELMING_FORCES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, OVERWHELMING_FORCES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(OVERWHELMING_FORCES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = forced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

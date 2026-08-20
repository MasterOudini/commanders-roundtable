// `Oxidize` — the Ring dies; the indestructible artifact land survives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { OXIDIZE_SCRIPT } from './oxidize';
import { OXIDIZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function oxidized(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Oxidize'], [victimName]],
    scripts: createRegistry([OXIDIZE_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Oxidize', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe('Oxidize', () => {
  test('the Ring dies', () => {
    const { g, victim } = oxidized('Sol Ring');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('Darksteel Citadel survives', () => {
    const { g, victim } = oxidized('Darksteel Citadel');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = OXIDIZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, OXIDIZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(OXIDIZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = oxidized('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

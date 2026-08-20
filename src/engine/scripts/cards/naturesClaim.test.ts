// `Nature's Claim` — the Ring dies and its controller gains 4; the
// indestructible artifact land survives and STILL pays its controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NATURES_CLAIM_SCRIPT } from './naturesClaim';
import { NATURE_S_CLAIM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function claimed(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Nature's Claim"], [victimName]],
    scripts: createRegistry([NATURES_CLAIM_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Nature's Claim", 'hand');
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

describe("Nature's Claim", () => {
  test('the Ring dies; its controller gains 4', () => {
    const { g, victim } = claimed('Sol Ring');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('Darksteel Citadel survives and its controller STILL gains', () => {
    const { g, victim } = claimed('Darksteel Citadel');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NATURE_S_CLAIM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NATURE_S_CLAIM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NATURE_S_CLAIM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = claimed('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

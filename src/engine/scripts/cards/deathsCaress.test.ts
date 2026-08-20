// `Death's Caress` — the Human's toughness comes back as life; a non-Human
// dies for nothing; the indestructible non-Human survives for nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEATHS_CARESS_SCRIPT } from './deathsCaress';
import { DEATH_S_CARESS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function caressed(target: 'human' | 'bear' | 'myr'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ["Death's Caress"],
      ['Angelheart Protector', 'Grizzly Bears', 'Darksteel Myr'],
    ],
    scripts: createRegistry([DEATHS_CARESS_SCRIPT]),
  });
  const human = put(g, 'p2', 'Angelheart Protector');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  const victim = target === 'human' ? human : target === 'bear' ? bears : myr;
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Death's Caress", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe("Death's Caress", () => {
  test('a destroyed Human pays its toughness in life', () => {
    const { g, victim } = caressed('human');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('a non-Human dies for nothing', () => {
    const { g, victim } = caressed('bear');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the indestructible non-Human survives for nothing', () => {
    const { g, victim } = caressed('myr');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEATH_S_CARESS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEATH_S_CARESS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEATH_S_CARESS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = caressed('human');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Triumphant Chomp` — the floor and the census, proven as two games: with no
// Dinosaur it is 2, and a 6/6 Dinosaur makes it 6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRIUMPHANT_CHOMP_SCRIPT } from './triumphantChomp';
import { TRIUMPHANT_CHOMP } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Triumphant Chomp';
const DINO = 'Colossal Dreadmaw'; // Creature — Dinosaur, 6/6
const VICTIM = 'Grave Titan'; // 6/6, so 2 marks it and 6 kills it

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chomped(mine: readonly string[]): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...mine], [VICTIM]],
    scripts: createRegistry([TRIUMPHANT_CHOMP_SCRIPT]),
  });
  mine.forEach((n) => put(g, 'p1', n));
  const victim = put(g, 'p2', VICTIM);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Triumphant Chomp', () => {
  test('no Dinosaur: the FLOOR of 2 still lands', () => {
    const { g, victim } = chomped([]);
    expect(g.state.cards[victim]?.damage).toBe(2);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('a 6/6 Dinosaur raises it to 6, which kills the 6/6', () => {
    const { g, victim } = chomped([DINO]);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRIUMPHANT_CHOMP.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRIUMPHANT_CHOMP.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRIUMPHANT_CHOMP.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = chomped([DINO]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

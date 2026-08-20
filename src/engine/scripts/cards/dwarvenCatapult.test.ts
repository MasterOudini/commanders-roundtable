// `Dwarven Catapult` — X = 5 over two creatures is 2 each, rounded down:
// the 1/1 dies, the 2/2 dies too, and X = 3 over two is 1 each.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DWARVEN_CATAPULT_SCRIPT } from './dwarvenCatapult';
import { DWARVEN_CATAPULT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flung(x: number): { g: Game; strix: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dwarven Catapult'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([DWARVEN_CATAPULT_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dwarven Catapult', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: x + 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, strix, bears };
}

describe('Dwarven Catapult', () => {
  test('X = 5 over two creatures is 2 each — both die', () => {
    const { g, strix, bears } = flung(5);
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('X = 3 over two creatures is 1 each — only the 1/1 dies', () => {
    const { g, strix, bears } = flung(3);
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DWARVEN_CATAPULT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DWARVEN_CATAPULT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DWARVEN_CATAPULT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flung(5);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Dakmor Plague` — 3 to every creature and every player: the 2/2 dies, the
// 6/6 stands marked, both life totals drop.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DAKMOR_PLAGUE_SCRIPT } from './dakmorPlague';
import { DAKMOR_PLAGUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function plagued(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dakmor Plague'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([DAKMOR_PLAGUE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dakmor Plague', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Dakmor Plague', () => {
  test('3 to each creature and each player', () => {
    const { g, bears, maw } = plagued();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(37);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DAKMOR_PLAGUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DAKMOR_PLAGUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DAKMOR_PLAGUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = plagued();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

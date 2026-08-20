// `Paraselene` — both enchantments die at 1 apiece.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PARASELENE_SCRIPT } from './paraselene';
import { PARASELENE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function eclipsed(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Paraselene', 'Captive Flame'], ['Captive Flame']],
    scripts: createRegistry([PARASELENE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Captive Flame');
  const theirs = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Paraselene', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Paraselene', () => {
  test('both enchantments die and pay 1 apiece', () => {
    const { g, mine, theirs } = eclipsed();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PARASELENE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PARASELENE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PARASELENE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = eclipsed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

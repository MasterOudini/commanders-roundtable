// `Swords to Plowshares` — the exile and the DERIVED-power gain, to the
// CONTROLLER: exiling the opponent's Dreadmaw pays the OPPONENT six.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SWORDS_TO_PLOWSHARES_SCRIPT } from './swordsToPlowshares';
import { SWORDS_TO_PLOWSHARES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Swords to Plowshares'], ['Colossal Dreadmaw']],
    scripts: createRegistry([SWORDS_TO_PLOWSHARES_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Swords to Plowshares', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Swords to Plowshares', () => {
  test('exiles the Dreadmaw and its CONTROLLER gains its six power', () => {
    const { g, theirs } = board();
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
    expect(g.state.players['p2']?.life).toBe(46);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SWORDS_TO_PLOWSHARES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SWORDS_TO_PLOWSHARES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SWORDS_TO_PLOWSHARES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

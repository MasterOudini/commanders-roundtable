// `Invoke the Winds` — their tapped artifact creature becomes MINE and
// stands up, indefinitely.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INVOKE_THE_WINDS_SCRIPT } from './invokeTheWinds';
import { INVOKE_THE_WINDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function invoked(): { g: Game; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Invoke the Winds'], ['Baleful Strix']],
    scripts: createRegistry([INVOKE_THE_WINDS_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [strix], tapped: true }));
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Invoke the Winds', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: strix }] }));
  settle(g);
  return { g, strix };
}

describe('Invoke the Winds', () => {
  test('the Strix is mine and untapped — control holds into the next turn', () => {
    const { g, strix } = invoked();
    expect(g.state.cards[strix]?.controller).toBe('p1');
    expect(g.state.cards[strix]?.owner).toBe('p2');
    expect(g.state.cards[strix]?.tapped).toBe(false);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(g.state.cards[strix]?.controller).toBe('p1');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INVOKE_THE_WINDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INVOKE_THE_WINDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INVOKE_THE_WINDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = invoked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

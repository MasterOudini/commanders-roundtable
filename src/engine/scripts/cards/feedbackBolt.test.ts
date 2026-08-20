// `Feedback Bolt` — two artifacts burn the face for 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FEEDBACK_BOLT_SCRIPT } from './feedbackBolt';
import { FEEDBACK_BOLT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bolted(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Feedback Bolt', 'Sol Ring', 'Lightning Greaves'], ['Grizzly Bears']],
    scripts: createRegistry([FEEDBACK_BOLT_SCRIPT]),
  });
  put(g, 'p1', 'Sol Ring');
  put(g, 'p1', 'Lightning Greaves');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Feedback Bolt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Feedback Bolt', () => {
  test('two artifacts burn the face for 2', () => {
    const { g } = bolted();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FEEDBACK_BOLT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FEEDBACK_BOLT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FEEDBACK_BOLT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bolted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

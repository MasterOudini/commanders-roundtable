// `Parallectric Feedback` — burns the caster for the spell's mana value;
// the spell still resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PARALLECTRIC_FEEDBACK_SCRIPT } from './parallectricFeedback';
import { PARALLECTRIC_FEEDBACK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fedback(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Parallectric Feedback'], ['Grizzly Bears']],
    scripts: createRegistry([PARALLECTRIC_FEEDBACK_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack[g.state.stack.length - 1]?.id;
  if (!stackId) throw new Error('no spell on the stack');
  const spell = put(g, 'p1', 'Parallectric Feedback', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'stack', id: stackId }],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Parallectric Feedback', () => {
  test('the caster takes the mv-2 burn and the Bears STILL resolves', () => {
    const { g, bears } = fedback();
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PARALLECTRIC_FEEDBACK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PARALLECTRIC_FEEDBACK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PARALLECTRIC_FEEDBACK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fedback();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

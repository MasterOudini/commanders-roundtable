// `Double Negative` — two held spells are both countered; one alone leaves
// the other to resolve.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DOUBLE_NEGATIVE_SCRIPT } from './doubleNegative';
import { SPHINXS_INSIGHT_SCRIPT } from './sphinxsInsight';
import { DOUBLE_NEGATIVE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Double Negative';
const BEARS = 'Grizzly Bears';
const INSIGHT = "Sphinx's Insight";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

/** p2 casts the Bears and, still holding priority, the Insight on top; p1 answers. */
function twoHeld(): { g: Game; bears: InstanceId; insight: InstanceId; bearsId: string; insightId: string; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, INSIGHT]],
    scripts: createRegistry([DOUBLE_NEGATIVE_SCRIPT, SPHINXS_INSIGHT_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS, 'hand');
  const insight = put(g, 'p2', INSIGHT, 'hand');
  const spell = put(g, 'p1', SPELL, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
  const bearsId = g.state.stack[0]?.id as string;
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: insight }));
  advanceUntil(g, (s) => s.stack.length === 2 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const insightId = g.state.stack.find((o) => o.id !== bearsId)?.id as string;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, insight, bearsId, insightId, logAt };
}

describe('Double Negative (up to two target spells)', () => {
  test('two targets: both spells countered, no card drawn', () => {
    const { g, bears, insight, bearsId, insightId, logAt } = twoHeld();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: bearsId }, { kind: 'stack', id: insightId }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[insight]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(drawsFor(g, 'p2', logAt)).toBe(0);
  });

  test('one target: the Bears die on the stack, the Insight resolves and draws two', () => {
    const { g, bears, insight, bearsId, logAt } = twoHeld();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: bearsId }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[insight]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(drawsFor(g, 'p2', logAt)).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DOUBLE_NEGATIVE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DOUBLE_NEGATIVE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DOUBLE_NEGATIVE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bearsId, insightId } = twoHeld();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: bearsId }, { kind: 'stack', id: insightId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

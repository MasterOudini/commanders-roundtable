// `Dream Fracture` — the held spell is countered, its caster draws, and so
// do I.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DREAM_FRACTURE_SCRIPT } from './dreamFracture';
import { DREAM_FRACTURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Dream Fracture';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

/** p2 mid-cast of the Bears, HELD on the stack; p1 answers with the counter. */
function fractured(): { g: Game; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([DREAM_FRACTURE_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS, 'hand');
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
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, bears, logAt };
}

describe('Dream Fracture', () => {
  test('the Bears never resolves; both players draw one', () => {
    const { g, bears, logAt } = fractured();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
    expect(drawsFor(g, 'p2', logAt)).toBe(1);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DREAM_FRACTURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DREAM_FRACTURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DREAM_FRACTURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fractured();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

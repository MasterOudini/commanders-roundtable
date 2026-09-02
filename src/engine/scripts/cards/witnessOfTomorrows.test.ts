// `Witness of Tomorrows` — flying plus a repeatable {3}{U} scry; no {T}, so
// the second activation in one turn is legal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WITNESS_OF_TOMORROWS_SCRIPT } from './witnessOfTomorrows';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WITNESS = 'Witness of Tomorrows';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answerScry(g: Game): void {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
  settle(g);
}

function board(): { g: Game; witness: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WITNESS], []],
    scripts: createRegistry([WITNESS_OF_TOMORROWS_SCRIPT]),
  });
  const witness = put(g, 'p1', WITNESS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  return { g, witness };
}

describe('Witness of Tomorrows', () => {
  test('it scries without tapping, and goes TWICE in one turn', () => {
    const { g, witness } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witness, abilityIndex: 0 }));
    answerScry(g);
    expect(g.state.cards[witness]?.tapped).toBe(false);
    const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: witness, abilityIndex: 0 });
    expect(again.ok).toBe(true);
  });

  test('the Witness flies', () => {
    const { g, witness } = board();
    const d = deps(createRegistry([WITNESS_OF_TOMORROWS_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, witness).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, witness } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witness, abilityIndex: 0 }));
    answerScry(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

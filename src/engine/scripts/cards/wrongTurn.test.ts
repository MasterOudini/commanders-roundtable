// `Wrong Turn` — the target OPPONENT gains control of the target creature.
//
// ⚠️ THIS FILE PINNED D255's ENGINE BUG A THIRD TIME, AND WIDENED IT, UNTIL
// D288 FIXED IT. The two specs here differ by KIND (player, then creature),
// and the resolve reads them by kind — yet a reordered answer [creature,
// player] was ACCEPTED at the aim and then FIZZLED, because CR 608.2b's
// re-check read spec 0 ("target opponent") against targets[0] (a creature).
// So the positional fizzle was never a same-kind problem: it hit ANY
// multi-spec spell whose answer arrived out of spec order. Since D288 the
// re-check asks whether SOME clause admits each target, and both orders
// resolve; the reordered case now lives in the happy path.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WRONG_TURN_SCRIPT } from './wrongTurn';
import { WRONG_TURN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import type { TargetChoice } from '../../types/state';

const SPELL = 'Wrong Turn';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(order: 'playerFirst' | 'cardFirst'): { g: Game; bears: InstanceId; accepted: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], []],
    scripts: createRegistry([WRONG_TURN_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const picks: TargetChoice[] =
    order === 'playerFirst'
      ? [
          { kind: 'player', id: 'p2' },
          { kind: 'card', id: bears },
        ]
      : [
          { kind: 'card', id: bears },
          { kind: 'player', id: 'p2' },
        ];
  const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: picks });
  settle(g);
  return { g, bears, accepted: res.ok };
}

describe('Wrong Turn', () => {
  test('in spec order: the opponent now controls my creature', () => {
    const { g, bears, accepted } = cast('playerFirst');
    expect(accepted).toBe(true);
    expect(g.state.cards[bears]?.controller).toBe('p2');
    expect(g.state.cards[bears]?.owner).toBe('p1');
  });

  test('the reordered answer is accepted and resolves the same way (D288)', () => {
    const { g, bears, accepted } = cast('cardFirst');
    expect(accepted).toBe(true);
    expect(g.state.cards[bears]?.controller).toBe('p2');
    expect(g.state.cards[bears]?.owner).toBe('p1');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WRONG_TURN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WRONG_TURN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WRONG_TURN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('playerFirst');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

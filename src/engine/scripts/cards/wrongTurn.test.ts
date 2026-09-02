// `Wrong Turn` — the target OPPONENT gains control of the target creature.
//
// ⚠️⚠️ THIS FILE PINS D255's ENGINE BUG A THIRD TIME, AND WIDENS IT. The two
// specs here differ by KIND (player, then creature), and the resolve reads
// them by kind — so I expected a reordered answer to be safe. MEASURED: it is
// not. Submit [creature, player] and the aim layer ACCEPTS the answer, then
// CR 608.2b's positional re-check reads spec 0 ("target opponent") against
// targets[0] (a creature), finds no match, and FIZZLES the whole spell. The
// controller stays put and nothing happens. So the positional fizzle is not a
// same-kind problem (Swift Kick D255, Wild Instincts D269): it hits ANY
// multi-spec spell whose answer arrives out of spec order. The card is
// correct either way; the test asserts the MEASURED behaviour so it goes RED
// the day the re-check is fixed, which is when this comment should go.

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

  test('⚠️ MEASURED BUG: the reordered answer is accepted and then does NOTHING', () => {
    const { g, bears, accepted } = cast('cardFirst');
    // The aim layer raises no objection...
    expect(accepted).toBe(true);
    // ...and then the positional re-check fizzles the spell: no control change.
    expect(g.state.cards[bears]?.controller).toBe('p1');
    // ⚠️ The specs differ by KIND here, so this is NOT the same-kind ambiguity
    // of D255/D269 — it is the re-check reading POSITIONALLY regardless. When
    // that is fixed this test SHOULD go red; fold it into the happy path.
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

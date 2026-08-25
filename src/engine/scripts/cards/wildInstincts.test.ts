// `Wild Instincts` — the pump lands BEFORE the fight, so the biter hits for
// its boosted power. The targets are identified BY CONTROLLER, never by
// index (D255).
//
// ⚠️⚠️ AND THIS FILE PINS A REAL ENGINE BUG, MEASURED HERE.
// D255 found it on Swift Kick; this reproduces it on a second card, so it is
// not one script's mistake. Submit the SAME two legal targets in the OTHER
// order and:
//   · the aim layer ACCEPTS the answer — `submit` returns ok, no refusal;
//   · the spell then does NOTHING — zero damage, no pump.
// `assignTargets` is a one-for-one MATCHING (D102): it proves a legal
// assignment EXISTS and does NOT reorder the answer. CR 608.2b's re-check
// then reads the specs POSITIONALLY, finds "you control" pointing at the
// opponent's creature, and fizzles the whole spell.
//
// The card is correct either way — the resolve below reads by controller and
// would do the right thing if it ever ran. The bug is that it does not run.
// The test asserts the MEASURED behaviour rather than the rules-correct one,
// so it goes green today and goes RED the moment the aim layer is fixed —
// which is exactly when someone should come back and delete this comment.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WILD_INSTINCTS_SCRIPT } from './wildInstincts';
import { WILD_INSTINCTS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import type { TargetChoice } from '../../types/state';

const SPELL = 'Wild Instincts';
const MINE = 'Grizzly Bears'; // 2/2 -> 4/4 after the pump
const THEIRS = 'Grave Titan'; // 6/6 — survives 4, so both halves are readable

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(order: 'mineFirst' | 'theirsFirst'): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  accepted: boolean;
} {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, MINE],
      [THEIRS],
    ],
    scripts: createRegistry([WILD_INSTINCTS_SCRIPT]),
  });
  const mine = put(g, 'p1', MINE);
  const theirs = put(g, 'p2', THEIRS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const picks: TargetChoice[] =
    order === 'mineFirst'
      ? [
          { kind: 'card', id: mine },
          { kind: 'card', id: theirs },
        ]
      : [
          { kind: 'card', id: theirs },
          { kind: 'card', id: mine },
        ];
  const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: picks });
  settle(g);
  return { g, mine, theirs, accepted: res.ok };
}

describe('Wild Instincts', () => {
  test('the pump lands first: my 2/2 hits for 4 and takes 6', () => {
    const { g, mine, theirs } = cast('mineFirst');
    expect(g.state.cards[theirs]?.damage).toBe(4);
    // A pumped 2/2 is a 4/4; a 6/6 bites back for 6 and kills it.
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
  });

  test('⚠️ MEASURED BUG: a SWAPPED answer is accepted and then does nothing', () => {
    const { g, mine, theirs, accepted } = cast('theirsFirst');
    // The aim layer raises no objection...
    expect(accepted).toBe(true);
    // ...and then the spell fizzles entirely: no damage either way, no pump.
    expect(g.state.cards[theirs]?.damage ?? 0).toBe(0);
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    // ⚠️ CR says both orders are the same legal assignment. When the aim layer
    // is fixed this test SHOULD go red — that is the signal to delete it and
    // fold the case into the happy path above.
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WILD_INSTINCTS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WILD_INSTINCTS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WILD_INSTINCTS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('mineFirst');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

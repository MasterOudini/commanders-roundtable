// `Wild Instincts` — the pump lands BEFORE the fight, so the biter hits for
// its boosted power. The targets are identified BY CONTROLLER, never by
// index (D255).
//
// ⚠️ THIS FILE PINNED A REAL ENGINE BUG, MEASURED HERE, UNTIL D288 FIXED IT.
// D255 found it on Swift Kick; this reproduced it on a second card. Submit
// the SAME two legal targets in the OTHER order and the aim layer ACCEPTED
// the answer while CR 608.2b's re-check read the specs POSITIONALLY, found
// "you control" pointing at the opponent's creature, and fizzled the whole
// spell. `assignTargets` is a one-for-one MATCHING (D102) that does not
// reorder; since D288 the re-check asks the same question by clause SEARCH,
// so both orders resolve — and the resolve reads by controller, so both
// orders resolve RIGHT. The swapped case now lives in the happy path.

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

  test('a SWAPPED answer is accepted and resolves the same way (D288)', () => {
    const { g, mine, theirs, accepted } = cast('theirsFirst');
    expect(accepted).toBe(true);
    expect(g.state.cards[theirs]?.damage).toBe(4);
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
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

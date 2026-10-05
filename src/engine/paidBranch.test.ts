// D628 - THE PAYMENT'S BODY IS A TEXT. `You may pay <cost>. If you do, <body>` (D369) and D415's verb price read a body the
// rules read only as a TEXT as the paid branch, clause by clause: two clauses of one sentence, an asking clause (the answer
// resumes what follows, D484), a sentence after it about what it made. What is proven: the parse (a conjunction body, a
// targeted one with its one target, a look across two sentences, a verb price's two clauses; a later sentence the rules read
// on its own staying OUTSIDE the branch; randomness refused); a paid branch that asks, and the clauses after the payment
// waiting for its answer; declining runs neither half of the branch; two paid branches arming delayed exiles under distinct
// ids, both firing. (No replay hash here: the test script is stamped onto a Bears off the log, payMana.test.ts's way -
// a replay never sees the stamp; the fuzz staple proves the replay.)
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const settle = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);

/** A test-only enters trigger whose payload the vocabulary reads whole (payMana.test.ts's shape). */
function script(oracleId: string, payload: string): CardScript {
  return {
    oracleId,
    name: 'Testing ' + oracleId,
    triggers: [
      {
        abilityId: 'a0',
        text: 'When this creature enters, ' + payload.charAt(0).toLowerCase() + payload.slice(1),
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
        label: () => 'Testing ' + oracleId,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(payload, 'Testing'), vocabularyTargets(payload)),
      },
    ],
  };
}
const LOOT = script('test-paid-loot', 'You may pay {1}. If you do, draw a card, then discard a card. You gain 3 life.');
const TOKEN = script('test-paid-token', 'You may pay {1}. If you do, create a 1/1 white Soldier creature token. Exile that token at the beginning of the next end step.');

/** p1's Bears stamped with `script`, entering with `mana` green floating; the table run to the first question. */
function entered(scripts: readonly CardScript[], oracleId: string, mana: number, g0?: Game): { g: Game; id: InstanceId } {
  const g = g0 ?? startedGame({ players: 2, decks: [[BEARS, BEARS, BEARS, BEARS, 'Forest', 'Forest'], [BEARS]], scripts: createRegistry([...scripts]) });
  if (!g0) {
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.stack.length === 0 && s.priority.awaiting === null, 60_000);
  }
  if (mana > 0) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: mana }));
  const id = put(g, 'p1', BEARS, 'hand');
  const inst = g.state.cards[id];
  if (inst) (inst as { oracleId: string }).oracleId = oracleId;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, id };
}

describe('D628 - the payment\'s body is a text', () => {
  test('the parse: a conjunction body, a targeted one, a look across two sentences, a verb price - each the paid branch', () => {
    const loot = vocabularyEffects('You may pay {1}. If you do, draw a card, then discard a card.', 'Testing');
    expect(loot.map((e) => e.kind)).toEqual(['payOptional']);
    expect(loot[0]?.pay?.ifPaid.map((e) => e.kind)).toEqual(['draw', 'discard']);
    expect(loot[0]?.pay?.ifNotPaid).toHaveLength(0);
    const drain = 'You may pay {B}. If you do, target player loses 2 life and you gain 2 life.';
    const d = vocabularyEffects(drain, 'Testing');
    expect(d[0]?.targetIndex).toBe(0);
    expect(d[0]?.pay?.ifPaid.map((e) => [e.kind, e.targetIndex])).toEqual([['loseLife', 0], ['gainLife', -1]]);
    expect(vocabularyTargets(drain)).toHaveLength(1);
    const look = vocabularyEffects('You may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.', 'Testing');
    expect(look.map((e) => e.kind)).toEqual(['payOptional']);
    expect(look[0]?.pay?.ifPaid.map((e) => e.kind)).toEqual(['lookAtTop']);
    const verb = vocabularyEffects('You may sacrifice a creature. If you do, put a +1/+1 counter on ~ and draw a card.', 'Testing');
    expect(verb[0]?.pay?.verbs?.costText).toBe('sacrifice a creature');
    expect(verb[0]?.pay?.ifPaid.map((e) => e.kind)).toEqual(['putCounters', 'draw']);
  });

  test('a later sentence the rules read on its own is not the branch\'s; randomness stays refused', () => {
    const p = parseEffects('You may pay {1}. If you do, draw a card. Each opponent loses 1 life.', 'Testing', true);
    expect(p.mode).toBe('auto');
    expect(p.effects.map((e) => e.kind)).toEqual(['payOptional', 'loseLife']);
    expect(p.effects[0]?.pay?.ifPaid.map((e) => e.kind)).toEqual(['draw']);
    expect(parseEffects('You may pay {B}. If you do, target player discards a card at random.', 'Testing', true).mode).not.toBe('auto');
  });

  test('paid: the branch draws, then asks the discard; the life gain after the payment waits for the answer', () => {
    const { g } = entered([LOOT], 'test-paid-loot', 1);
    expect(g.state.priority.awaiting?.kind).toBe('payMana');
    const hand0 = g.state.zones.hand.p1?.length ?? 0;
    const grave0 = g.state.zones.graveyard.p1?.length ?? 0;
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(g);
    expect(g.state.priority.awaiting?.kind, 'the branch asked its discard').toBe('chooseFromZone');
    expect(g.state.zones.hand.p1?.length ?? 0).toBe(hand0 + 1);
    expect(g.state.players.p1?.life, 'the clause after the payment waits').toBe(life0);
    const pick = (g.state.zones.hand.p1 ?? [])[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [pick] }));
    settle(g);
    expect(g.state.zones.hand.p1?.length ?? 0).toBe(hand0);
    expect(g.state.zones.graveyard.p1?.length ?? 0).toBe(grave0 + 1);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
  });

  test('declined: neither half of the branch, and the life gain still happens', () => {
    const { g } = entered([LOOT], 'test-paid-loot', 1);
    const hand0 = g.state.zones.hand.p1?.length ?? 0;
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand.p1?.length ?? 0).toBe(hand0);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
  });

  test('two paid branches arm their delayed exiles under distinct ids, and both tokens are exiled at the end step', () => {
    const first = entered([TOKEN], 'test-paid-token', 2);
    must(first.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(first.g);
    const { g } = entered([TOKEN], 'test-paid-token', 0, first.g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(g);
    const tokens = (g.state.zones.battlefield ?? []).filter((c) => g.state.cards[c]?.isToken === true);
    expect(tokens).toHaveLength(2);
    const ids = g.state.delayedTriggers.map((t) => t.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size, 'two delayed triggers, two ids').toBe(2);
    advanceUntil(g, (s) => s.turn.step === 'cleanup' || s.turn.turnNumber > g.state.turn.turnNumber, 60_000);
    expect(tokens.filter((c) => g.state.cards[c] !== undefined && g.state.cards[c]?.zone.kind === 'battlefield')).toHaveLength(0);
  });
});

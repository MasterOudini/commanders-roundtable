// D369 - THE PAYMENT PROMPT, proven at the carrier.
//
// Two printed shapes, one prompt: "<effect> unless <player> pays <cost>" asks the PAYER and runs
// the effect only when they decline; "You may pay <cost>. If you do, <effect>" asks the caster
// and runs it only when they pay. The payer is not always the caster - Mana Leak asks the
// spell's controller - and the prompt is raised only while the price can be met.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const LEAK = 'Mana Leak';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2 casts a Bears; p1 answers with Mana Leak. The prompt lands on p2, who has `mana` spare in the pool. */
function leaked(mana: number): { g: Game; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[LEAK], [BEARS]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const bears = put(g, 'p2', BEARS, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 + mana }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === bears)?.id as string;
  const leak = put(g, 'p1', LEAK, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: leak }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
  return { g, bears };
}

describe('D369 - the payment prompt', () => {
  test('the parser reads both shapes, with the body parsed by the same rules', () => {
    const leak = parseEffects('Counter target spell unless its controller pays {3}.', LEAK, true);
    expect(leak.mode).toBe('auto');
    expect(leak.effects[0]?.kind).toBe('payOptional');
    expect(leak.effects[0]?.pay?.who).toBe('targetController');
    expect(leak.effects[0]?.pay?.cost?.raw).toBe('{3}');
    expect(leak.effects[0]?.pay?.ifNotPaid[0]?.kind).toBe('counter');
    expect(leak.effects[0]?.pay?.ifNotPaid[0]?.targetIndex).toBe(0);
    expect(leak.effects[0]?.pay?.ifPaid).toHaveLength(0);
    const may = vocabularyEffects('You may pay {2}. If you do, draw a card.', 'Testing');
    expect(may[0]?.pay?.who).toBe('controller');
    expect(may[0]?.pay?.ifPaid[0]?.kind).toBe('draw');
    expect(may[0]?.pay?.ifNotPaid).toHaveLength(0);
    const life = vocabularyEffects('Sacrifice this creature unless you pay 2 life.', 'Testing');
    expect(life[0]?.pay?.life).toBe(2);
    expect(life[0]?.pay?.cost).toBeNull();
    expect(life[0]?.pay?.ifNotPaid[0]?.kind).toBe('sacrificeSelf');
  });

  test('the shapes it must refuse stay refused', () => {
    expect(parseEffects('Counter target spell unless any player pays {1}.', 'Testing', true).mode).not.toBe('auto');
    expect(parseEffects('Counter target spell unless its controller pays {X}.', 'Testing', true).mode).not.toBe('auto');
    expect(parseEffects('You may draw a card unless that player pays {1}.', 'Testing', true).mode).not.toBe('auto');
    expect(parseEffects('Target player discards a card unless they pay {2}.', 'Testing', true).mode).not.toBe('auto');
  });

  test("Mana Leak asks the SPELL'S controller, and paying lets the spell resolve", () => {
    const { g, bears } = leaked(3);
    expect(g.state.priority.awaiting?.kind).toBe('payMana');
    if (g.state.priority.awaiting?.kind !== 'payMana') throw new Error('no prompt');
    expect(g.state.priority.awaiting.player).toBe('p2');
    expect(g.state.priority.awaiting.cost?.raw).toBe('{3}');
    const pool0 = g.state.players.p2?.pool.G ?? 0;
    must(g.submit({ t: 'AnswerPayMana', player: 'p2', pay: true }));
    settle(g);
    expect(g.state.players.p2?.pool.G ?? 0).toBe(pool0 - 3);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('declining counters it', () => {
    const { g, bears } = leaked(3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p2', pay: false }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('a payer who cannot pay is never asked - the spell is countered at once', () => {
    const { g, bears } = leaked(0);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the wrong player cannot answer', () => {
    const { g } = leaked(3);
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }).ok).toBe(false);
  });

  test('replays to the same hash after a payment', () => {
    const { g } = leaked(3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p2', pay: true }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// The "you may pay ... if you do" shape lands on TRIGGERS (the spells that print it are rows),
// so its proof is a test-only script whose payload the vocabulary reads whole.
const MAY_ORACLE = 'test-may-pay';
const MAY: CardScript = {
  oracleId: MAY_ORACLE,
  name: 'Testing May Pay',
  triggers: [
    {
      abilityId: 'a0',
      text: 'When this creature enters, you may pay {1}. If you do, draw a card.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => 'Testing May Pay - pay {1} to draw',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects('You may pay {1}. If you do, draw a card.', 'Testing May Pay'), []),
    },
  ],
};

function mayPay(mana: number): { g: Game } {
  const g = startedGame({ players: 2, decks: [[BEARS, BEARS], [BEARS]], scripts: createRegistry([MAY]) });
  settle(g);
  holdEverywhere(g);
  if (mana > 0) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: mana }));
  const id = put(g, 'p1', BEARS, 'hand');
  const inst = g.state.cards[id];
  if (inst) (inst as { oracleId: string }).oracleId = MAY_ORACLE;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
  return { g };
}

describe('D369 - "you may pay ... if you do" from a trigger', () => {
  test('paying runs the branch; declining runs nothing', () => {
    const a = mayPay(1);
    expect(a.g.state.priority.awaiting?.kind).toBe('payMana');
    const hand0 = a.g.state.zones.hand.p1?.length ?? 0;
    must(a.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(a.g);
    expect(a.g.state.zones.hand.p1?.length ?? 0).toBe(hand0 + 1);
    const b = mayPay(1);
    const hand1 = b.g.state.zones.hand.p1?.length ?? 0;
    must(b.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(b.g);
    expect(b.g.state.zones.hand.p1?.length ?? 0).toBe(hand1);
  });

  test('with nothing to pay it, the trigger asks nothing and does nothing', () => {
    const { g } = mayPay(0);
    expect(g.state.priority.awaiting).toBeNull();
  });
});

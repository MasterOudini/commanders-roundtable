// D415 - THE VERB PRICE AT RESOLUTION, proven at the carrier.
//
// D369's prompt with a chooser-verb price: `You may discard a card. If you do, draw a card.` asks the
// caster to NAME a card, and `Sacrifice it unless you sacrifice a Forest.` asks for the Forest; the
// object's own sacrifice (`you may sacrifice it`) is a price too. The prompt is raised only while the
// price can be met (an empty hand, no Forest: the unpaid branch runs at once), the picks are checked
// against the board as it stands when the answer arrives, and a discard ships no candidates (a hand is
// hidden) where a sacrifice ships its own.
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
const FOREST = 'Forest';
const DISCOVERY = 'Thrilling Discovery';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** A test-only ETB script whose payload the vocabulary reads whole (the D369 pattern). */
function etb(oracleId: string, name: string, sentence: string): CardScript {
  return {
    oracleId,
    name,
    triggers: [
      {
        abilityId: 'a0',
        text: `When this creature enters, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
        label: () => `${name} - ${sentence}`,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(sentence, name), []),
      },
    ],
  };
}
const DISCARD = etb('test-verb-discard', 'Testing Discard Price', 'You may discard a card. If you do, draw a card.');
const UNLESS = etb('test-verb-unless', 'Testing Unless Price', 'Sacrifice it unless you sacrifice a Forest.');
const SELF = etb('test-verb-self', 'Testing Self Price', 'You may sacrifice it. If you do, draw a card.');

/** p1 puts a Bears wearing `script` onto the battlefield with `hand` Bears in hand and `forests` Forests out. */
function armed(script: CardScript, hand: number, forests: number, emptyHand = false): { g: Game; self: InstanceId; hand: InstanceId[]; forests: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[BEARS, BEARS, BEARS], [BEARS]], scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  // The opening seven leave first when the case wants an EMPTY hand (a dealt hand never is).
  if (emptyHand) for (const id of [...(g.state.zones.hand.p1 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' } }));
  const inHand: InstanceId[] = [];
  for (let i = 0; i < hand; i++) inHand.push(put(g, 'p1', BEARS, 'hand'));
  const out: InstanceId[] = [];
  for (let i = 0; i < forests; i++) out.push(put(g, 'p1', FOREST, 'battlefield'));
  const self = put(g, 'p1', BEARS, 'hand');
  const inst = g.state.cards[self];
  if (inst) (inst as { oracleId: string }).oracleId = script.oracleId;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
  return { g, self, hand: inHand, forests: out };
}
const zone = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';
const handSize = (g: Game): number => g.state.zones.hand.p1?.length ?? 0;

describe('D415 - the verb price: the parser', () => {
  test('the two forms and the self price read auto with the price on the spec; the refusals hold', () => {
    const may = parseEffects('You may discard a card. If you do, draw a card.', 'X', true);
    expect(may.mode).toBe('auto');
    expect(may.effects[0]?.kind).toBe('payOptional');
    expect(may.effects[0]?.pay?.verbs?.discardCost?.count).toBe(1);
    expect(may.effects[0]?.pay?.verbs?.costText).toBe('discard a card');
    expect(may.effects[0]?.pay?.ifPaid[0]?.kind).toBe('draw');
    const unless = parseEffects('Sacrifice it unless you sacrifice two Mountains.', 'X', true);
    expect(unless.mode).toBe('auto');
    expect(unless.effects[0]?.pay?.verbs?.sacrificeCost?.count).toBe(2);
    expect(unless.effects[0]?.pay?.ifNotPaid[0]?.kind).toBe('sacrificeSelf');
    expect(unless.effects[0]?.pay?.cost).toBeNull();
    const self = parseEffects('You may sacrifice it. If you do, draw a card.', 'X', true);
    expect(self.effects[0]?.pay?.verbs?.sacrificeSelf).toBe(true);
    const ret = parseEffects("Sacrifice this creature unless you return a land you control to its owner's hand.", 'X', true);
    expect(ret.effects[0]?.pay?.verbs?.returnCost?.count).toBe(1);
    // A random discard, another player's verb, two verbs: not this reader's.
    expect(parseEffects('You may discard a card at random. If you do, draw a card.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Counter target spell unless its controller sacrifices a creature.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('You may sacrifice an artifact or discard a card. If you do, draw a card.', 'X', true).mode).not.toBe('auto');
    // The mana price still reads the D369 way, with no verb.
    expect(parseEffects('You may pay {1}. If you do, draw a card.', 'X', true).effects[0]?.pay?.verbs).toBeNull();
  });
});

describe('D415 - a discard price from a trigger', () => {
  test('the prompt names the price and ships no candidates; paying names the card, and the pick is checked', () => {
    const { g, hand } = armed(DISCARD, 1, 0);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('payMana');
    if (ask?.kind !== 'payMana') return;
    expect(ask.verbs?.costText).toBe('discard a card');
    expect(ask.candidates).toBeUndefined();
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }).ok).toBe(false);
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: ['nope'] }).ok).toBe(false);
    const before = handSize(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [hand[0] as InstanceId] }));
    settle(g);
    expect(zone(g, hand[0] as InstanceId)).toBe('graveyard');
    expect(handSize(g)).toBe(before);
    expect(g.log.some((e) => e.body.t === 'PaymentAnswered' && e.body.paid && e.body.verb === 'discard a card')).toBe(true);
  });
  test('declining pays nothing and draws nothing; an empty hand is never asked', () => {
    const { g, hand } = armed(DISCARD, 1, 0);
    const before = handSize(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(zone(g, hand[0] as InstanceId)).toBe('hand');
    expect(handSize(g)).toBe(before);
    const empty = armed(DISCARD, 0, 0, true);
    expect(empty.g.state.priority.awaiting).toBeNull();
  });
});

describe('D415 - an unless price from a trigger', () => {
  test('the Forest is the candidate the prompt ships; declining sacrifices the creature, paying keeps it', () => {
    const a = armed(UNLESS, 0, 1);
    const ask = a.g.state.priority.awaiting;
    expect(ask?.kind).toBe('payMana');
    if (ask?.kind !== 'payMana') return;
    expect(ask.verbs?.costText).toBe('sacrifice a Forest');
    expect(ask.candidates).toEqual([a.forests[0]]);
    expect(ask.ifNotPaid[0]?.kind).toBe('sacrificeSelf');
    must(a.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(a.g);
    expect(zone(a.g, a.self)).toBe('graveyard');
    expect(zone(a.g, a.forests[0] as InstanceId)).toBe('battlefield');
    const b = armed(UNLESS, 0, 1);
    // A Bears is not a Forest: refused by name, and the question stands.
    expect(b.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [b.self] }).ok).toBe(false);
    expect(b.g.state.priority.awaiting?.kind).toBe('payMana');
    must(b.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [b.forests[0] as InstanceId] }));
    settle(b.g);
    expect(zone(b.g, b.forests[0] as InstanceId)).toBe('graveyard');
    expect(zone(b.g, b.self)).toBe('battlefield');
  });
  test('with no Forest the price cannot be paid: no question, the creature is sacrificed at once', () => {
    const { g, self } = armed(UNLESS, 0, 0);
    expect(g.state.priority.awaiting).toBeNull();
    settle(g);
    expect(zone(g, self)).toBe('graveyard');
  });
});

describe('D415 - the self price', () => {
  test('you may sacrifice it: the object is its own candidate; paying sacrifices it and draws', () => {
    const { g, self } = armed(SELF, 0, 0);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('payMana');
    if (ask?.kind !== 'payMana') return;
    expect(ask.verbs?.sacrificeSelf).toBe(true);
    expect(ask.candidates).toEqual([self]);
    const before = handSize(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [self] }));
    settle(g);
    expect(zone(g, self)).toBe('graveyard');
    expect(handSize(g)).toBe(before + 1);
  });
});

describe('D415 - Thrilling Discovery, a real spell with no script', () => {
  test('gain 2, then the discard-two price: paid with two named cards, three are drawn; the hash replays', () => {
    const g = startedGame({ players: 2, decks: [[DISCOVERY, BEARS, BEARS], [BEARS]], scripts: createRegistry([]) });
    settle(g);
    holdEverywhere(g);
    const a = put(g, 'p1', BEARS, 'hand');
    const b = put(g, 'p1', BEARS, 'hand');
    const spell = put(g, 'p1', DISCOVERY, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('payMana');
    if (ask?.kind !== 'payMana') return;
    expect(ask.verbs?.discardCost?.count).toBe(2);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [a] }).ok).toBe(false);
    const before = handSize(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [a, b] }));
    settle(g);
    expect(zone(g, a)).toBe('graveyard');
    expect(zone(g, b)).toBe('graveyard');
    expect(handSize(g)).toBe(before + 1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D584 - THE REFLEXIVE TRIGGER (CR 603.12): `<price>. When you do, <payload>`. The price is one D369 / D415 already read;
// paying it CREATES a triggered ability whose effect is the payload - put on the stack the next time a player would
// receive priority (the drain guard) and aimed THEN, never by the object that asked the price. What is proven here: the
// reading (the payload one clause's own text, its clauses cut out of the object's; the refusals); the flow (the outer
// trigger goes on untargeted, the price is paid, THEN the aim - a creature that entered in between is a legal target);
// the decline and the unpayable price (nothing triggers); 603.3d (paid, no legal target: the trigger is removed, the
// price stays paid); 608.2b (the target gone in response); the sacrificed creature's own targeted dies trigger beside it
// (ordered, then each aimed in turn); a graveyard target; a mana price's `it` (the source); a spell's reflexive (its
// source the card in the graveyard); an activated ability's (no target asked at activation); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { createRegistry } from './scripts/registryCore';
import type { CardScript } from './scripts/api';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import { SOLDIER_TOKEN } from '../data/fixtures/engineCards';

const BALLISTA = 'Terror Ballista';
const BALLISTA_PAYLOAD = 'you may sacrifice another creature. When you do, destroy target creature an opponent controls.';
const LANDS = ['Swamp', 'Swamp', 'Swamp', 'Mountain', 'Mountain', 'Mountain', 'Swamp', 'Mountain'];
const main1 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const firstPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null, 20_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const zone = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;
const said = (g: Game, text: string) => g.state.narration.some((l) => l.text.includes(text));
const reflexives = (g: Game) => g.log.filter((e) => e.body.t === 'ReflexiveTriggered').length;
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

// A test script: the card's printed trigger, an enters head over the payload the row maker hands the vocabulary.
function entersDef(name: string, payload: string): CardScript {
  const card = deps().oracle.byName(name);
  if (!card) throw new Error('no such fixture: ' + name);
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [
      {
        abilityId: 'etb-reflexive',
        text: 'TEST: When this creature enters, ' + payload,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        targets,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        label: () => name + ' - ' + payload,
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}

// A test script on a TOKEN printing (a Soldier): its enters trigger asks a reflexive price.
function tokenDef(payload: string): CardScript {
  const effects = vocabularyEffects(payload, SOLDIER_TOKEN.name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: SOLDIER_TOKEN.oracleId,
    name: SOLDIER_TOKEN.name,
    triggers: [
      {
        abilityId: 'etb-reflexive',
        text: 'TEST: When this creature enters, ' + payload,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        targets,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        label: () => SOLDIER_TOKEN.name + ' - ' + payload,
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}

// Terror Ballista's reflexive under an enters head; `fodder` p1's creatures, `theirs` p2's.
function ballista(fodder: readonly string[], theirs: readonly string[], later: readonly string[] = []): { g: Game; self: InstanceId; mine: InstanceId[]; foes: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[BALLISTA, ...fodder, ...LANDS], [...theirs, ...later, ...LANDS]], scripts: createRegistry([entersDef(BALLISTA, BALLISTA_PAYLOAD)]) });
  holdEverywhere(g);
  main1(g);
  const mine = fodder.map((n) => put(g, 'p1', n));
  const foes = theirs.map((n) => put(g, 'p2', n));
  settle(g);
  const self = put(g, 'p1', BALLISTA);
  return { g, self, mine, foes };
}

describe('D584 - the reflexive trigger (CR 603.12)', () => {
  test('the reading: the price and payload are one clause; the payload' + "'" + 's clauses are its own, cut out of the object' + "'" + 's', () => {
    const read = parseEffects(BALLISTA_PAYLOAD, BALLISTA, true);
    expect(read.mode).toBe('auto');
    expect(read.effects).toHaveLength(1);
    const pay = read.effects[0]?.pay;
    expect(pay?.verbs?.costText).toBe('sacrifice another creature');
    expect(pay?.ifPaid, 'no branch runs in the answer').toEqual([]);
    expect(pay?.reflexive?.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['destroy', 0]]);
    expect(pay?.reflexive?.targets.map((t) => t.text)).toEqual(['target creature an opponent controls']);
    expect(parseTargetClauses(BALLISTA_PAYLOAD), 'the object declares none').toEqual([]);
    expect(vocabularyTargets(BALLISTA_PAYLOAD)).toEqual([]);
    // A mana price, a two-sentence payload with a referent (Spined Tyrranax).
    const tyr = parseEffects('you may pay {2}{G}. When you do, put a +1/+1 counter on target creature. That creature gains trample until end of turn.', 'Spined Tyrranax', true);
    expect(tyr.mode).toBe('auto');
    expect(tyr.effects[0]?.pay?.cost?.raw).toBe('{2}{G}');
    expect(tyr.effects[0]?.pay?.reflexive?.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['putCounters', 0], ['pump', 0]]);
    // A spell (Lithobraking): the clause before the price reads on its own; the payload aims at nothing.
    const litho = parseEffects('Create a Lander token. Then you may sacrifice an artifact. When you do, Lithobraking deals 2 damage to each creature.', 'Lithobraking', true);
    expect(litho.mode).toBe('auto');
    expect(litho.effects.map((e) => e.kind)).toEqual(['createToken', 'payOptional']);
    expect(litho.effects[1]?.pay?.reflexive?.targets).toEqual([]);
  });

  test('the refusals: a payload that borrows from the price, a modal payload, a nested marker, a mandatory price; a def' + "'" + 's random one', () => {
    for (const text of [
      'you may sacrifice a creature. When you do, ~ deals damage equal to the sacrificed creature' + "'" + 's power to any target.',
      'you may pay {1}. When you do, choose one —',
      'you may pay {1}. When you do, you may pay {2}. When you do, draw a card.',
      'Sacrifice a creature. When you do, destroy target creature.',
    ]) {
      expect(parseEffects(text, 'Test Card', true).mode, text).not.toBe('auto');
    }
    // Randomness reads (the reflexive trigger resolves through the executor, which threads the generator); a DEF' + "'" + 's resolve
    // cannot, and the vocabulary refuses it by its text.
    expect(() => vocabularyEffects('you may pay {1}. When you do, target player discards a card at random.', 'Test Card')).toThrow(/randomness/);
  });

  test('the outer trigger goes on untargeted; the price is paid; THEN the aim - a creature that entered in between is legal', () => {
    const { g, mine, foes } = ballista(['Grizzly Bears'], [], ['Colossal Dreadmaw']);
    const [bears] = mine;
    expect(g.state.stack, 'the enters trigger').toHaveLength(1);
    expect(g.state.stack[0]?.targets, 'aimed at nothing').toEqual([]);
    expect(g.state.priority.awaiting, 'no question as it goes on').toBeNull();
    expect(foes).toEqual([]);
    // In response, p2 gets a creature: it did not exist when the trigger went on.
    const late = put(g, 'p2', 'Colossal Dreadmaw');
    firstPrompt(g);
    const price = g.state.priority.awaiting;
    if (price?.kind !== 'payMana') throw new Error('expected the price, got ' + price?.kind);
    expect(price.reflexive?.targets).toHaveLength(1);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [bears as string] }));
    expect(zone(g, bears as string), 'the price is paid').toBe('graveyard');
    expect(reflexives(g), 'the reflexive trigger triggered').toBe(1);
    firstPrompt(g);
    const aim = g.state.priority.awaiting;
    expect(aim?.kind === 'chooseTargets' && aim.player).toBe('p1');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: late }] }));
    settle(g);
    expect(zone(g, late), 'the creature that entered in between').toBe('graveyard');
    hashHolds(g);
  });

  test('declined: nothing triggers and nothing is asked', () => {
    const { g, mine } = ballista(['Grizzly Bears'], ['Colossal Dreadmaw']);
    firstPrompt(g);
    expect(g.state.priority.awaiting?.kind).toBe('payMana');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(reflexives(g)).toBe(0);
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseTargets'), 'no aim asked').toBe(false);
    expect(zone(g, mine[0] as string)).toBe('battlefield');
    hashHolds(g);
  });

  test('an unpayable price is said and triggers nothing', () => {
    const { g } = ballista([], ['Colossal Dreadmaw']);
    settle(g);
    expect(said(g, 'the price cannot be paid')).toBe(true);
    expect(reflexives(g)).toBe(0);
    hashHolds(g);
  });

  test('paid with no legal target: the reflexive trigger is removed (CR 603.3d) and the price stays paid', () => {
    const { g, mine } = ballista(['Grizzly Bears'], []);
    firstPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [mine[0] as string] }));
    settle(g);
    expect(reflexives(g)).toBe(1);
    expect(said(g, 'no legal target, so it is removed from the stack (CR 603.3d)')).toBe(true);
    expect(zone(g, mine[0] as string)).toBe('graveyard');
    hashHolds(g);
  });

  test('the target gone in response: the reflexive trigger does nothing (CR 608.2b)', () => {
    const { g, mine, foes } = ballista(['Grizzly Bears'], ['Colossal Dreadmaw']);
    firstPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [mine[0] as string] }));
    firstPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: foes[0] as string }] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: foes[0] as string, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(said(g, 'no legal target left, so it does not resolve (CR 608.2b)')).toBe(true);
    expect(zone(g, foes[0] as string)).toBe('hand');
    hashHolds(g);
  });

  test('the sacrificed creature' + "'" + 's own targeted dies trigger beside it: ordered, then each aimed in turn', () => {
    const { g, mine, foes } = ballista(['Kami of Empty Graves', 'Bile Urchin'], ['Colossal Dreadmaw']);
    const [kami, urchin] = mine;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: urchin as string, to: { kind: 'graveyard', player: 'p1' } }));
    firstPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [kami as string] }));
    firstPrompt(g);
    const order = g.state.priority.awaiting;
    if (order?.kind !== 'orderTriggers') throw new Error('expected the ordering, got ' + order?.kind);
    expect(order.triggers).toHaveLength(2);
    must(g.submit({ t: 'OrderTriggers', player: 'p1', order: [...order.triggers] }));
    // One aim at a time: each answered before the next is asked (the drain guard).
    for (let i = 0; i < 2; i++) {
      const aim = g.state.priority.awaiting;
      if (aim?.kind !== 'chooseTargets') throw new Error('expected an aim, got ' + aim?.kind);
      const pick = aim.label.includes('soulshift') ? (urchin as string) : (foes[0] as string);
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: pick }] }));
      if (i === 0) firstPrompt(g);
    }
    expect(g.state.stack.filter((o) => o.kind === 'triggered').map((o) => o.targets.length)).toEqual([1, 1]);
    settle(g);
    expect(zone(g, foes[0] as string), 'the reflexive destroyed its target').toBe('graveyard');
    hashHolds(g);
  });

  test('a graveyard target resolves (Young Necromancer: the reflexive' + "'" + 's picks are its own, not bound aims)', () => {
    const NAME = 'Young Necromancer';
    const PAYLOAD = 'you may exile two cards from your graveyard. When you do, return target creature card from your graveyard to the battlefield.';
    const g = startedGame({ players: 2, decks: [[NAME, 'Colossal Dreadmaw', 'Grizzly Bears', 'Llanowar Elves', ...LANDS], [...LANDS]], scripts: createRegistry([entersDef(NAME, PAYLOAD)]) });
    holdEverywhere(g);
    main1(g);
    const dread = put(g, 'p1', 'Colossal Dreadmaw', 'graveyard');
    const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    const elves = put(g, 'p1', 'Llanowar Elves', 'graveyard');
    settle(g);
    put(g, 'p1', NAME);
    firstPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [bears, elves] }));
    firstPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dread }] }));
    settle(g);
    expect(zone(g, dread), 'returned from the graveyard').toBe('battlefield');
    expect(zone(g, bears)).toBe('exile');
    hashHolds(g);
  });

  test('a mana price' + "'" + 's `it` is the source (Sparktongue Dragon): it deals the damage', () => {
    const NAME = 'Sparktongue Dragon';
    const PAYLOAD = 'you may pay {2}{R}. When you do, it deals 3 damage to any target.';
    const g = startedGame({ players: 2, decks: [[NAME, ...LANDS], [...LANDS]], scripts: createRegistry([entersDef(NAME, PAYLOAD)]) });
    holdEverywhere(g);
    main1(g);
    const dragon = put(g, 'p1', NAME);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
    firstPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    firstPrompt(g);
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 3);
    expect(g.log.some((e) => e.body.t === 'DamageDealt' && e.body.damages.some((d) => d.source === dragon)), 'the Dragon dealt it').toBe(true);
    hashHolds(g);
  });

  test('a spell' + "'" + 's reflexive (Lithobraking): its source is the card in the graveyard, and it resolves after the spell', () => {
    const g = startedGame({ players: 2, decks: [['Lithobraking', 'Grizzly Bears', ...LANDS], ['Colossal Dreadmaw', ...LANDS]] });
    holdEverywhere(g);
    main1(g);
    const spell = put(g, 'p1', 'Lithobraking', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const dread = put(g, 'p2', 'Colossal Dreadmaw');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    firstPrompt(g);
    const price = g.state.priority.awaiting;
    if (price?.kind !== 'payMana') throw new Error('expected the price, got ' + price?.kind);
    const lander = price.candidates?.[0];
    if (!lander) throw new Error('the Lander is the artifact to sacrifice');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [lander] }));
    const marker = g.log.find((e) => e.body.t === 'ReflexiveTriggered');
    expect(marker?.body.t === 'ReflexiveTriggered' && marker.body.source).toBe(spell);
    expect(zone(g, spell), 'the spell has resolved').toBe('graveyard');
    settle(g);
    expect(zone(g, bears), 'two damage to each creature').toBe('graveyard');
    expect(zone(g, dread)).toBe('battlefield');
    expect(g.state.cards[dread]?.damage).toBe(2);
    hashHolds(g);
  });

  // The review (wf_bb9f0484-72d) caught this one: the marker was made only while the source instance existed.
  test('a TOKEN source that ceased before the answer still makes it (CR 113.7a) - the price paid, the trigger off its printing', () => {
    const g = startedGame({ players: 2, decks: [[...LANDS], [...LANDS]], scripts: createRegistry([tokenDef('you may pay {1}. When you do, target player loses 2 life.')]) });
    holdEverywhere(g);
    main1(g);
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    const token = [...g.state.zones.battlefield].find((id) => g.state.cards[id]?.isToken && g.state.cards[id]?.controller === 'p1') as string;
    expect(token, 'the token').toBeTruthy();
    expect(g.state.stack, 'its enters trigger').toHaveLength(1);
    // It leaves before the trigger resolves, and ceases to exist (CR 704.5d).
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: token, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    firstPrompt(g);
    expect(g.state.cards[token], 'the token has ceased').toBeUndefined();
    expect(g.state.priority.awaiting?.kind).toBe('payMana');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    expect(reflexives(g), 'the reflexive trigger triggered').toBe(1);
    firstPrompt(g);
    expect(g.state.priority.awaiting?.kind, 'aimed off the printing').toBe('chooseTargets');
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 2);
    hashHolds(g);
  });

  test('an activated ability' + "'" + 's reflexive (Eden, Seat of the Sanctum) asks no target at activation', () => {
    const eden = deps().oracle.byName('Eden, Seat of the Sanctum');
    if (!eden) throw new Error('no Eden fixture');
    const ability = faceOf(eden, 0).activated.find((a) => a.effectText.includes('When you do'));
    expect(ability, 'the line').toBeDefined();
    expect(ability?.targets, 'asked at activation: none').toEqual([]);
    const read = parseEffects(ability?.effectText ?? '', 'Eden, Seat of the Sanctum', true);
    expect(read.mode).toBe('auto');
    expect(read.effects).toHaveLength(2);
    expect(read.effects[1]?.pay?.verbs?.sacrificeSelf).toBe(true);
    expect(read.effects[1]?.pay?.reflexive?.targets).toHaveLength(1);
  });
});

// D418 - THE COUNT EXPRESSION, proven at the parser, the counter and the executor.
//
// `<effect> for each <noun>.` and `<effect with X>, where X is the number of <nouns>.` ride the
// spec as `per` and are read ONCE at resolution off the board (CR 608.2h); the executor multiplies
// the amount (a pump's halves) by the count, and a count of zero is a clause that says it did
// nothing. The proof spells: Spontaneous Generation (the hand), Deploy to the Front (X tokens,
// every creature), Downhill Charge (+X/+0, the Mountains), Aerial Assault (two clauses, a keyword
// count); the kicked count on Lightkeeper of Emeria's trigger.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { LIGHTKEEPER_OF_EMERIA } from '../data/fixtures/engineCards';
import { countOf } from './count';
import { derive, makeDeriveCache } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects } from './scripts/vocabulary';
import { advanceUntil, deps as depsOf, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { CountExpr } from './types/oracle';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';
const ELEMENTAL = 'Air Elemental';
const THOPTER = 'Ornithopter';
const D = createRegistry([]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, p: 'p1' | 'p2' = 'p1'): number => g.state.players[p]?.life ?? 0;
const tokens = (g: Game, from: number): number => g.log.slice(from).filter((e) => e.body.t === 'TokenCreated').length;
const narratedCount = (g: Game, from: number, needle: string): boolean => g.log.slice(from).some((e) => e.body.t === 'Narrated' && JSON.stringify(e.body).includes(needle));
const per = (text: string): CountExpr | null | undefined => parseEffects(text, 'Probe', true).effects[0]?.per;
const mode = (text: string): string => parseEffects(text, 'Probe', true).mode;

/** A game in p1's third-turn main phase with every seat under full control. */
function armed(p1: readonly string[], p2: readonly string[] = [CYCLOPS]): Game {
  const g = startedGame({ players: 2, decks: [[...p1], [...p2]], scripts: D });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
  return g;
}
const count = (g: Game, expr: CountExpr, source: InstanceId | null = null, kicked = 0): number => countOf(g.state, depsOf(D), 'p1', expr, source, kicked, makeDeriveCache(g.state));
const perm = (over: Partial<Extract<CountExpr, { kind: 'permanents' }>> = {}): CountExpr => ({
  kind: 'permanents', controller: 'you', predicates: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }],
  other: false, attacking: false, untapped: false, keyword: null, powerAtLeast: null, withPlusCounter: false, named: null, ...over,
});

describe('D418 - the parser', () => {
  test('`for each <noun>` and `where X is the number of <nouns>` read with the count on the spec; the base reads as one', () => {
    const a = parseEffects('You gain 1 life for each creature you control.', 'Probe', true);
    expect(a.mode).toBe('auto');
    expect(a.effects[0]?.kind).toBe('gainLifePer');
    const b = parseEffects('You gain 3 life for each artifact you control.', 'Probe', true);
    expect(b.effects[0]?.kind).toBe('gainLife');
    expect(b.effects[0]?.amount).toBe(3);
    expect(b.effects[0]?.per).toMatchObject({ kind: 'permanents', controller: 'you', predicates: [{ types: ['Artifact'] }] });
    const c = parseEffects('Create X 1/1 white Soldier creature tokens, where X is the number of creatures on the battlefield.', 'Probe', true);
    expect(c.effects[0]?.kind).toBe('createToken');
    expect(c.effects[0]?.amount).toBe(1);
    expect(c.effects[0]?.per).toMatchObject({ kind: 'permanents', controller: 'any' });
    const d = parseEffects('Target creature gets +X/+0 until end of turn, where X is the number of Mountains you control.', 'Probe', true);
    expect(d.effects[0]?.kind).toBe('pump');
    expect([d.effects[0]?.power, d.effects[0]?.toughness]).toEqual([1, 0]);
    expect(d.effects[0]?.per).toMatchObject({ kind: 'permanents', predicates: [{ subtypes: ['Mountain'] }] });
    expect(parseEffects('Draw X cards, where X is the number of artifacts you control.', 'Probe', true).effects[0]?.per).toMatchObject({ kind: 'permanents' });
    expect(parseEffects('Target creature gets -X/-X until end of turn, where X is the number of Elves you control.', 'Probe', true).effects[0]).toMatchObject({ kind: 'pump', power: -1, toughness: -1 });
  });
  test('the nouns: the hand, the graveyard (a predicate, a name), the kicks, the deaths, the party, the players, the basic land types, the refinements', () => {
    expect(per('Create a 1/1 green Saproling creature token for each card in your hand.')).toEqual({ kind: 'cardsInHand', who: 'you' });
    expect(per('You gain 1 life for each Elf card in your graveyard.')).toMatchObject({ kind: 'cardsInGraveyard', predicates: [{ subtypes: ['Elf'] }], named: null });
    expect(per('Create a 2/2 black Zombie creature token for each card named Undead Servant in your graveyard.')).toEqual({ kind: 'cardsInGraveyard', predicates: null, named: 'Undead Servant' });
    expect(per('You gain 2 life for each time it was kicked.')).toEqual({ kind: 'kicked' });
    expect(per('Put a +1/+1 counter on this creature for each creature that died this turn.')).toEqual({ kind: 'diedThisTurn' });
    expect(per('You gain 2 life for each creature in your party.')).toEqual({ kind: 'party' });
    expect(per('You gain 1 life for each opponent.')).toEqual({ kind: 'players', who: 'opponents' });
    expect(per('Target creature gets +1/+1 until end of turn for each basic land type among lands you control.')).toEqual({ kind: 'basicLandTypes' });
    expect(per('Draw a card for each other Dinosaur you control.')).toMatchObject({ kind: 'permanents', other: true, predicates: [{ subtypes: ['Dinosaur'] }] });
    expect(per('Draw a card for each creature you control with a +1/+1 counter on it.')).toMatchObject({ kind: 'permanents', withPlusCounter: true });
    expect(per('You gain 1 life for each creature you control with power 4 or greater.')).toMatchObject({ kind: 'permanents', powerAtLeast: 4 });
    expect(per('You gain 1 life for each creature you control with flying.')).toMatchObject({ kind: 'permanents', keyword: 'flying' });
    expect(per('You gain 1 life for each attacking creature.')).toMatchObject({ kind: 'permanents', controller: 'any', attacking: true });
    expect(per('You gain 1 life for each untapped creature you control.')).toMatchObject({ kind: 'permanents', untapped: true });
    expect(per('You gain 2 life for each creature you control named Cleric of the Forward Order.')).toMatchObject({ kind: 'permanents', named: 'Cleric of the Forward Order' });
    expect(per('You gain 1 life for each creature your opponents control.')).toMatchObject({ kind: 'permanents', controller: 'opponents' });
  });
  test('refused: an X/X token, a bare X, a referent controller, a tapped noun, an unknown keyword, two nouns, a non-amount kind', () => {
    expect(mode('Create an X/X green Ooze creature token, where X is the number of creatures you control.')).not.toBe('auto');
    expect(mode('Target creature gets +X/+X until end of turn, where X is the number of creatures you control.')).toBe('auto');
    expect(mode('Draw X cards, where X is the number of creatures they control.')).not.toBe('auto');
    expect(mode('You gain 1 life for each tapped creature you control.')).not.toBe('auto');
    expect(mode('You gain 1 life for each creature you control with shadow.')).not.toBe('auto');
    expect(mode('You gain 1 life for each artifact and creature you control.')).not.toBe('auto');
    expect(mode('You gain 1 life for each creature.')).not.toBe('auto');
    expect(mode('Destroy target creature for each artifact you control.')).not.toBe('auto');
    expect(mode('Scry X, where X is the number of creatures you control.')).not.toBe('auto');
  });
});

describe('D418 - the count, read off the board', () => {
  test('permanents: the controller, `other`, the keyword, the power floor, the counter, the name, untapped, the players', () => {
    const g = armed([BEARS, BEARS, ELEMENTAL, THOPTER, CYCLOPS], [CYCLOPS, BEARS]);
    const b1 = put(g, 'p1', BEARS);
    const b2 = put(g, 'p1', BEARS);
    put(g, 'p1', ELEMENTAL);
    put(g, 'p1', THOPTER);
    put(g, 'p1', CYCLOPS);
    put(g, 'p2', CYCLOPS);
    put(g, 'p2', BEARS);
    settle(g);
    expect(count(g, perm())).toBe(5);
    expect(count(g, perm({ controller: 'opponents' }))).toBe(2);
    expect(count(g, perm({ controller: 'any' }))).toBe(7);
    expect(count(g, perm({ other: true }), b1)).toBe(4);
    expect(count(g, perm({ keyword: 'flying' }))).toBe(2);
    expect(count(g, perm({ predicates: [{ supertypes: [], types: ['Artifact'], subtypes: [], colors: [] }] }))).toBe(1);
    expect(count(g, perm({ predicates: [{ supertypes: [], types: [], subtypes: [], colors: [] }] }))).toBe(5);
    expect(count(g, perm({ powerAtLeast: 4 }))).toBe(2);
    expect(count(g, perm({ named: BEARS }))).toBe(2);
    expect(count(g, perm({ withPlusCounter: true }))).toBe(0);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: b2, kind: '+1/+1', delta: 1 }));
    expect(count(g, perm({ withPlusCounter: true }))).toBe(1);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [b1, b2], tapped: true }));
    expect(count(g, perm({ untapped: true }))).toBe(3);
    expect(count(g, perm({ attacking: true, controller: 'any' }))).toBe(0);
    expect(count(g, { kind: 'players', who: 'opponents' })).toBe(1);
    expect(count(g, { kind: 'players', who: 'any' })).toBe(2);
  });
  test('the hand, the graveyard (a predicate, a name), the deaths this turn, the kicks', () => {
    const g = armed([BEARS, BEARS, ELEMENTAL, 'Forest'], [CYCLOPS]);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    expect(count(g, { kind: 'cardsInHand', who: 'you' })).toBe(hand0);
    const b1 = put(g, 'p1', BEARS);
    put(g, 'p1', ELEMENTAL, 'graveyard');
    put(g, 'p1', 'Forest', 'graveyard');
    expect(count(g, { kind: 'cardsInGraveyard', predicates: null, named: null })).toBe(2);
    expect(count(g, { kind: 'cardsInGraveyard', predicates: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }], named: null })).toBe(1);
    expect(count(g, { kind: 'cardsInGraveyard', predicates: null, named: ELEMENTAL })).toBe(1);
    expect(count(g, { kind: 'cardsInGraveyard', predicates: null, named: BEARS })).toBe(0);
    expect(count(g, { kind: 'diedThisTurn' })).toBe(0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: b1, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(count(g, { kind: 'diedThisTurn' })).toBe(1);
    expect(count(g, { kind: 'kicked' }, null, 3)).toBe(3);
    expect(count(g, { kind: 'kicked' }, null, 0)).toBe(0);
  });
  test('the party is the largest set of distinct roles; the basic land types are counted once each', () => {
    const g = armed(['Acolyte of Xathrid', 'Triton Shorethief', 'Cliffhaven Sell-Sword', 'Fugitive Wizard', 'Triton Shorethief', 'Mountain', 'Forest', 'Commercial District', 'Plains'], [CYCLOPS]);
    put(g, 'p1', 'Triton Shorethief');
    put(g, 'p1', 'Triton Shorethief');
    settle(g);
    expect(count(g, { kind: 'party' }), 'two Rogues fill one role').toBe(1);
    put(g, 'p1', 'Acolyte of Xathrid');
    put(g, 'p1', 'Cliffhaven Sell-Sword');
    put(g, 'p1', 'Fugitive Wizard');
    settle(g);
    expect(count(g, { kind: 'party' })).toBe(4);
    expect(count(g, { kind: 'basicLandTypes' })).toBe(0);
    put(g, 'p1', 'Mountain');
    put(g, 'p1', 'Forest');
    put(g, 'p1', 'Commercial District');
    settle(g);
    expect(count(g, { kind: 'basicLandTypes' }), 'Mountain and Forest, the District adding neither').toBe(2);
    put(g, 'p1', 'Plains');
    settle(g);
    expect(count(g, { kind: 'basicLandTypes' })).toBe(3);
  });
});

const power = (g: Game, id: InstanceId): number | null => derive(g.state, depsOf(D).oracle, depsOf(D).scripts, id).power;

describe('D418 - the proof spells', () => {
  test('Spontaneous Generation: a Saproling per card in hand, counted as the spell resolves', () => {
    const g = armed(['Spontaneous Generation', BEARS, BEARS, ELEMENTAL]);
    const card = put(g, 'p1', 'Spontaneous Generation', 'hand');
    const inHand = (g.state.zones.hand.p1 ?? []).length - 1;
    expect(inHand).toBeGreaterThan(1);
    mana(g, 'G', 1); mana(g, 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(tokens(g, n0)).toBe(inHand);
    expect(narratedCount(g, n0, `counts ${inHand} for`)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
  test('Deploy to the Front: X Soldiers, X the creatures on the battlefield under anyone', () => {
    const g = armed(['Deploy to the Front', BEARS, ELEMENTAL], [CYCLOPS]);
    put(g, 'p1', BEARS);
    put(g, 'p1', ELEMENTAL);
    put(g, 'p2', CYCLOPS);
    settle(g);
    const card = put(g, 'p1', 'Deploy to the Front', 'hand');
    mana(g, 'W', 2); mana(g, 'C', 5);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(tokens(g, n0)).toBe(3);
    expect(count(g, perm({ controller: 'any' })), 'the tokens are creatures now, counted after').toBe(6);
  });
  test('Downhill Charge: +X/+0 with X the Mountains, on the targeted creature', () => {
    const g = armed(['Downhill Charge', BEARS, 'Mountain', 'Mountain', 'Mountain']);
    const bears = put(g, 'p1', BEARS);
    put(g, 'p1', 'Mountain'); put(g, 'p1', 'Mountain'); put(g, 'p1', 'Mountain');
    settle(g);
    const card = put(g, 'p1', 'Downhill Charge', 'hand');
    mana(g, 'R', 1); mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(power(g, bears)).toBe(5);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(power(g, bears), 'until end of turn').toBe(2);
  });
  test('Aerial Assault: the destroy aims, the life counts the fliers; with none the clause says it counts nothing', () => {
    const g = armed(['Aerial Assault', 'Aerial Assault', ELEMENTAL, THOPTER], [CYCLOPS, CYCLOPS]);
    put(g, 'p1', ELEMENTAL); put(g, 'p1', THOPTER);
    const target = put(g, 'p2', CYCLOPS);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [target], tapped: true }));
    settle(g);
    const card = put(g, 'p1', 'Aerial Assault', 'hand');
    mana(g, 'W', 1); mana(g, 'C', 2);
    const life0 = life(g);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(life(g)).toBe(life0 + 2);
    // No flier left: the destroy still runs, the life clause counts nothing and says so.
    for (const id of [...g.state.zones.battlefield]) if (g.state.cards[id]?.controller === 'p1') must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    const target2 = put(g, 'p2', CYCLOPS);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [target2], tapped: true }));
    settle(g);
    const card2 = put(g, 'p1', 'Aerial Assault', 'hand');
    mana(g, 'W', 1); mana(g, 'C', 2);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: card2, targets: [{ kind: 'card', id: target2 }] }));
    settle(g);
    expect(g.state.cards[target2]?.zone.kind).toBe('graveyard');
    expect(life(g)).toBe(life0 + 2);
    expect(narratedCount(g, n1, 'counts nothing')).toBe(true);
    expect(g.log.slice(n1).some((e) => e.body.t === 'LifeChanged')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// The kicked count lands on a permanent's TRIGGER (the spells print none), so its proof is a test-only
// script over the real carrier whose payload the vocabulary reads whole (the D417 pattern).
const LIGHTKEEPER: CardScript = {
  oracleId: LIGHTKEEPER_OF_EMERIA.oracleId,
  name: LIGHTKEEPER_OF_EMERIA.name,
  triggers: [
    {
      abilityId: 'a0',
      text: 'When this creature enters, you gain 2 life for each time it was kicked.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => 'Lightkeeper of Emeria - the kicked life',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects('You gain 2 life for each time it was kicked.', 'Lightkeeper of Emeria'), []),
    },
  ],
};

describe('D418 - the kicked count on a trigger', () => {
  test('kicked twice: 4 life; unkicked: the clause counts nothing and says so', () => {
    const R = createRegistry([LIGHTKEEPER]);
    const g = startedGame({ players: 2, decks: [['Lightkeeper of Emeria', 'Lightkeeper of Emeria', BEARS], [CYCLOPS]], scripts: R });
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    const first = put(g, 'p1', 'Lightkeeper of Emeria', 'hand');
    mana(g, 'W', 3); mana(g, 'C', 3);
    const life0 = life(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first, kicked: 2 }));
    settle(g);
    expect(g.state.cards[first]?.kicked).toBe(2);
    expect(life(g)).toBe(life0 + 4);
    expect(narratedCount(g, n0, 'counts 2 for')).toBe(true);
    const second = put(g, 'p1', 'Lightkeeper of Emeria', 'hand');
    mana(g, 'W', 1); mana(g, 'C', 3);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second }));
    settle(g);
    expect(life(g)).toBe(life0 + 4);
    expect(narratedCount(g, n1, 'counts nothing')).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

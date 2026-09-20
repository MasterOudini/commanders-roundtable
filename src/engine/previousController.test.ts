// D504 - THE PREVIOUS OBJECT'S CONTROLLER. `Its controller creates a 3/3 green Beast creature token.` / `That creature's
// controller mills four cards.` / `Its owner ...` after a clause about an object is the player-aimed clause the
// vocabulary already reads, planned aimless (`ofPreviousPlayer`) and bound as it runs to the controller or owner the
// object was last known to have when the clause before acted on it (CR 608.2h), or to a countered spell's controller.
// What is proven here: the readings (and the sentence refused with no object before it); Beast Within on the
// opponent's Bears (the Beast is p2's, the Bears in p2's graveyard, nothing on p1's side); Generous Gift on p1's own
// Bears (the Elephant is p1's); Countermand on p1's own spell (p1 mills four - the stack object's controller);
// Dismal Failure on p1's own spell (the discard is asked of the spell's controller); Crib Swap on a Bears p1 took
// with Act of Treason (the Shapeshifter is p1's - the controller as last known - and the Bears go to p2's graveyard,
// their owner's); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, StackId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, targetIndex: e.targetIndex, ...(e.ofPreviousPlayer !== undefined ? { ofPreviousPlayer: e.ofPreviousPlayer } : {}) })) }; };
const tokensOf = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((c) => g.state.cards[c]?.isToken === true && g.state.cards[c]?.controller === who);
const bound = (g: Game) => g.log.filter((e) => e.body.t === 'ReferentPlayerBound').map((e) => (e.body.t === 'ReferentPlayerBound' ? e.body.player : ''));

describe("D504 - the previous object's controller", () => {
  test('the readings: the token, the mill, the discard, the life; the owner; and the sentence refused with no object before it', () => {
    expect(kinds('Destroy target permanent. Its controller creates a 3/3 green Beast creature token.')).toEqual({ mode: 'auto', effects: [{ kind: 'destroy', targetIndex: 0 }, { kind: 'createToken', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds('Counter target spell. Its controller mills four cards.')).toEqual({ mode: 'auto', effects: [{ kind: 'counter', targetIndex: 0 }, { kind: 'mill', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds('Counter target spell. Its controller discards a card.')).toEqual({ mode: 'auto', effects: [{ kind: 'counter', targetIndex: 0 }, { kind: 'discard', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds("Destroy target creature. It can't be regenerated. That creature's controller creates a 3/3 green Ape creature token.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'destroy' }, {}, { kind: 'createToken', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds('Exile target creature. Its controller gains 4 life.')).toEqual({ mode: 'auto', effects: [{ kind: 'exile', targetIndex: 0 }, { kind: 'gainLife', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds('Destroy target artifact. Its owner creates a 1/1 white Spirit creature token with flying.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'destroy' }, { kind: 'createToken', ofPreviousPlayer: 'owner' }] });
    expect(kinds('Draw a card. Its controller mills four cards.').mode, 'no object before it: unread').not.toBe('auto');
    expect(kinds('Its controller creates a 3/3 green Beast creature token.').mode, 'nothing before it: unread').not.toBe('auto');
  });

  test("Beast Within on the opponent's Bears: the Beast is p2's, the Bears in p2's graveyard, nothing on p1's side; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Beast Within'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Beast Within', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone, 'the Bears destroyed').toEqual({ kind: 'graveyard', player: 'p2' });
    const beasts = tokensOf(g, 'p2');
    expect(beasts, "one token on p2's side").toHaveLength(1);
    expect(g.state.cards[beasts[0] as string]?.controller, "the Beast is p2's").toBe('p2');
    expect(tokensOf(g, 'p1'), "nothing on p1's side").toHaveLength(0);
    expect(bound(g), 'the marker names p2').toEqual(['p2']);
    expect(g.state.cards[spell]?.zone.kind, 'Beast Within resolved into the graveyard').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Generous Gift on p1's own Bears: the Elephant is p1's; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Generous Gift', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Generous Gift', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone, 'the Bears destroyed').toEqual({ kind: 'graveyard', player: 'p1' });
    expect(tokensOf(g, 'p1'), "the Elephant on p1's side").toHaveLength(1);
    expect(tokensOf(g, 'p2'), "nothing on p2's side").toHaveLength(0);
    expect(bound(g)).toEqual(['p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Countermand on p1's own spell: the countered spell's controller mills four; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Countermand', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const counter = put(g, 'p1', 'Countermand', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    const spell = g.state.stack[g.state.stack.length - 1]?.id as StackId;
    expect(spell).toBeDefined();
    const lib0 = (g.state.zones.library.p1 ?? []).length;
    const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
    mana(g, 'p1', 'UUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: counter, targets: [{ kind: 'stack', id: spell }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'the Bears countered').toBe('graveyard');
    expect((g.state.zones.library.p1 ?? []).length, 'four cards milled off the top').toBe(lib0 - 4);
    // The Bears, Countermand and the four milled cards.
    expect((g.state.zones.graveyard.p1 ?? []).length).toBe(gy0 + 6);
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.from.kind === 'library' && m.from.player === 'p2' && m.to.kind === 'graveyard')), "p2's library not milled").toBe(false);
    expect(bound(g)).toEqual(['p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Dismal Failure on p1's own spell: the discard is asked of the countered spell's controller; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Dismal Failure', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    put(g, 'p1', 'Grizzly Bears', 'hand');
    put(g, 'p1', 'Grizzly Bears', 'hand');
    const counter = put(g, 'p1', 'Dismal Failure', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    const spell = g.state.stack[g.state.stack.length - 1]?.id as StackId;
    mana(g, 'p1', 'UUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: counter, targets: [{ kind: 'stack', id: spell }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseFromZone');
    expect(ask?.kind === 'chooseFromZone' ? ask.player : null, 'the discard is asked of p1, the countered spell\'s controller').toBe('p1');
    expect(ask?.kind === 'chooseFromZone' ? ask.zone : null).toBe('hand');
    const hand = g.state.zones.hand.p1 ?? [];
    const pick = hand[0] as string;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [pick] }));
    settle(g);
    expect(g.state.cards[pick]?.zone.kind, 'the chosen card discarded').toBe('graveyard');
    expect(bound(g)).toEqual(['p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Crib Swap on a Bears p1 stole with Act of Treason: the Shapeshifter is p1's (the controller as last known), the Bears exiled; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Act of Treason', 'Crib Swap'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const treason = put(g, 'p1', 'Act of Treason', 'hand');
    const swap = put(g, 'p1', 'Crib Swap', 'hand');
    main(g, 3);
    mana(g, 'p1', 'RRR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: treason, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.controller, 'p1 controls the Bears').toBe('p1');
    mana(g, 'p1', 'WWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: swap, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'the Bears exiled').toBe('exile');
    expect(tokensOf(g, 'p1'), "the Shapeshifter on p1's side - the controller as last known").toHaveLength(1);
    expect(tokensOf(g, 'p2'), "nothing on p2's side").toHaveLength(0);
    expect(bound(g)).toEqual(['p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D507 - THE REFERENT SEARCH. `Its controller may search their library for a basic land card, put it onto the
// battlefield tapped, then shuffle.` after a clause about an object is the caster's own search sentence with its person
// changed, bound as it runs (D504's `ofPreviousPlayer`) to the object's controller, who is asked - the offer, then the
// reveal stage - and finds in their OWN library. What is proven here: the readings (the `may` form, the third-person
// form, and the sentence refused with no object before it); Path to Exile on the opponent's Bears (p2 is asked, accepts,
// finds a Forest that enters tapped on p2's side; declines - nothing found, nothing asked twice); Cleansing Wildfire on
// the opponent's Forest (the clause AFTER the ask - `Draw a card.` - runs once the answer is in, and the ask is raised
// once: a spliced step carries its clause's index, so the continuation is the clauses after it, not the whole list
// again); the replay hash on each.
describe('D507 - the referent search', () => {
  const searches = (g: Game) => g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'searchLibrary').length;

  test('the readings: the may form, the third-person form, and the sentence refused with no object before it', () => {
    expect(kinds('Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.')).toEqual({ mode: 'auto', effects: [{ kind: 'exile', targetIndex: 0 }, { kind: 'search', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds('Destroy target creature or planeswalker. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.')).toEqual({ mode: 'auto', effects: [{ kind: 'destroy', targetIndex: 0 }, { kind: 'search', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    expect(kinds('Destroy target land. Its controller searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.')).toEqual({ mode: 'auto', effects: [{ kind: 'destroy', targetIndex: 0 }, { kind: 'search', targetIndex: -1, ofPreviousPlayer: 'controller' }] });
    const read = parseEffects('Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.', '~', true);
    const search = read.effects[1];
    expect(search?.self, 'not the caster\'s own search').toBe(false);
    expect(search?.search?.optional, 'the may form is optional').toBe(true);
    expect(search?.search?.destination).toBe('battlefield');
    expect(search?.search?.tapped).toBe(true);
    expect(kinds('Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.').mode, 'nothing before it: unread').not.toBe('auto');
  });

  test("Path to Exile on the opponent's Bears: p2 is asked, accepts, and finds a Forest that enters tapped on p2's side; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Path to Exile'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Path to Exile', 'hand');
    main(g, 3);
    const p1Lands = g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p1').length;
    mana(g, 'p1', 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    const offer = g.state.priority.awaiting;
    expect(offer?.kind).toBe('searchLibrary');
    expect(offer?.kind === 'searchLibrary' ? offer.player : null, 'the search is asked of p2, the exiled creature\'s controller').toBe('p2');
    expect(offer?.kind === 'searchLibrary' ? offer.optional : null, 'the offer first').toBe(true);
    expect(g.state.cards[bears]?.zone.kind, 'the Bears are already exiled when p2 is asked').toBe('exile');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: false }));
    const stage = g.state.priority.awaiting;
    expect(stage?.kind === 'searchLibrary' ? stage.optional : null, 'the reveal stage').toBe(false);
    const forest = (g.state.zones.library.p2 ?? []).find((id) => nameOf(g, id) === 'Forest');
    expect(forest, "a Forest in p2's library").toBeDefined();
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [forest as InstanceId], declined: false }));
    settle(g);
    expect(g.state.cards[forest as InstanceId]?.zone, "the Forest on p2's battlefield").toEqual({ kind: 'battlefield', player: 'p2' });
    expect(g.state.cards[forest as InstanceId]?.controller).toBe('p2');
    expect(g.state.cards[forest as InstanceId]?.tapped, 'entered tapped').toBe(true);
    expect(g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p1').length, "nothing on p1's side").toBe(p1Lands);
    expect(bound(g), 'the marker names p2, once').toEqual(['p2']);
    expect(searches(g), 'the offer and the reveal stage, nothing more').toBe(2);
    expect(g.state.cards[spell]?.zone.kind, 'Path to Exile resolved into the graveyard').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Path to Exile declined: p2 looks at nothing, finds nothing, and is not asked again; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Path to Exile'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Path to Exile', 'hand');
    main(g, 3);
    const p2Board = g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p2').length;
    mana(g, 'p1', 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: true }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p2').length, 'the Bears gone, nothing found').toBe(p2Board - 1);
    expect(searches(g), 'the offer alone').toBe(1);
    expect(bound(g)).toEqual(['p2']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Cleansing Wildfire on the opponent's Forest: p2 finds a Swamp, then p1 draws - the clause after the ask runs once the answer is in, and the ask is raised once; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Cleansing Wildfire'], ['Forest']] });
    holdEverywhere(g);
    const forest = put(g, 'p2', 'Forest', 'battlefield');
    const spell = put(g, 'p1', 'Cleansing Wildfire', 'hand');
    main(g, 3);
    const handBefore = (g.state.zones.hand.p1 ?? []).length;
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: forest }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    expect((g.state.zones.hand.p1 ?? []).length, 'the draw waits for the answer').toBe(handBefore - 1);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: false }));
    const swamp = (g.state.zones.library.p2 ?? []).find((id) => nameOf(g, id) === 'Swamp');
    expect(swamp, "a Swamp in p2's library").toBeDefined();
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [swamp as InstanceId], declined: false }));
    settle(g);
    expect(g.state.cards[forest]?.zone, "the Forest in p2's graveyard").toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[swamp as InstanceId]?.zone).toEqual({ kind: 'battlefield', player: 'p2' });
    expect(g.state.cards[swamp as InstanceId]?.tapped).toBe(true);
    expect((g.state.zones.hand.p1 ?? []).length, 'the draw after the answer - the spell left the hand, one card came').toBe(handBefore);
    expect(searches(g), 'the offer and the reveal stage - the continuation is the clauses after the search, not the list again').toBe(2);
    expect(bound(g), 'bound once').toEqual(['p2']);
    expect(g.state.priority.awaiting).toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

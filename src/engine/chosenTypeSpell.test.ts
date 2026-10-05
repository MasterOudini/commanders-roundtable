// D632 - THE CHOSEN TYPE AT RESOLUTION AND THE COLOUR OTHER THAN. `Choose a creature type.` on an instant or sorcery is an
// ask - D465's prompt, raised by the executor as the spell resolves, the clauses after it riding it (D484) - and the clauses
// read `of that type` / `of the chosen type` as a sentinel subtype (`CHOSEN_TYPE`) that the answer substitutes before they
// resume. `As this land enters, choose a color other than <color>.` (the Gates; the Thriving lands print it beside their tap
// on one line) is D465's colour prompt with the colour it refuses. What is proven: the parse (the eleven spells read whole,
// the scopes and the count nouns carry the sentinel, a clause over the chosen type with no choice before it stays unread,
// the lands' faces); Distant Melody (the prompt as it resolves, the draw counted over the type named); Kindred Dominance
// (every creature but the type destroyed); Crippling Fear (-3/-3 to every other); the Thriving land (tapped, the excluded
// colour refused, the harness's answer past it, the chosen colour tapped for); the cards complete; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { faceOf } from './oracle';
import { derive } from './derive';
import { manaSourcesOf } from './mana';
import { parseEffects } from '../data/effectParse';
import { engineCompleteness } from '../data/engineComplete';
import { CHOSEN_TYPE } from './types/oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SPELLS = ['Distant Melody', 'Harmonized Crescendo', 'Luminescent Rain', 'Roar of the Crowd', 'Coordinated Barrage', "Pack's Disdain", 'Crippling Fear', 'Outbreak', 'Kindred Dominance', 'Raise the Palisade', 'And They Shall Know No Fear'];
const LANDS = ['Thriving Heath', 'Thriving Moor', 'Thriving Bluff', 'Thriving Grove', 'Thriving Isle', 'Manor Gate', 'Cliffgate', 'Citadel Gate', 'Black Dragon Gate', 'Sea Gate'];
// The Thriving line with no exclusion (`This land enters tapped. As it enters, choose a color.`): the tap was unread too.
const PLAIN = ['Uncharted Haven', "Valgavoth's Lair", 'Crossroads Village', 'Night Market', 'Mirage Mesa'];
const FILLER = Array.from({ length: 14 }, () => 'Island');

const card = (name: string) => {
  const c = deps().oracle.byName(name);
  if (!c) throw new Error('no such fixture: ' + name);
  return c;
};
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const untilType = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseCreatureType', 20_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const zone = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;
const pt = (g: Game, id: InstanceId) => { const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return [d.power, d.toughness]; };

/** The spell in hand, p1's and p2's creatures on the battlefield, p1's precombat main of turn 3. */
function table(spell: string, mine: readonly string[], theirs: readonly string[]): { g: Game; cast: InstanceId; p1: InstanceId[]; p2: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[spell, ...mine, ...FILLER], [...theirs, ...FILLER]], options: { maxHandSize: null } });
  holdEverywhere(g);
  const cast = put(g, 'p1', spell, 'hand');
  const p1 = mine.map((n) => put(g, 'p1', n));
  const p2 = theirs.map((n) => put(g, 'p2', n));
  main(g, 3);
  return { g, cast, p1, p2 };
}

describe('D632 - the parse', () => {
  test('the eleven spells read whole: the choice an ask, the clauses after it over the sentinel', () => {
    for (const name of SPELLS) expect(faceOf(card(name), 0).effectMode, name).toBe('auto');
    const melody = faceOf(card('Distant Melody'), 0);
    expect(melody.effects.map((e) => e.kind)).toEqual(['chooseType', 'draw']);
    expect(JSON.stringify(melody.effects[1]?.per)).toContain(CHOSEN_TYPE);
    expect(faceOf(card('Kindred Dominance'), 0).effects[1]?.scopes).toEqual([{ kind: 'creature', controller: 'any', subtype: CHOSEN_TYPE, subtypeAbsent: true }]);
    expect(faceOf(card('Outbreak'), 0).effects[1]?.scopes).toEqual([{ kind: 'creature', controller: 'any', subtype: CHOSEN_TYPE }]);
    expect(faceOf(card('And They Shall Know No Fear'), 0).effects[1]?.scopes).toEqual([{ kind: 'creature', controller: 'you', subtype: CHOSEN_TYPE }]);
  });

  test('a clause over the chosen type with no choice before it stays unread', () => {
    expect(parseEffects('Creatures you control of the chosen type get +1/+1 until end of turn.', 'X', true).mode).toBe('manual');
    expect(parseEffects('Draw a card for each permanent you control of that type.', 'X', true).mode).toBe('manual');
    expect(parseEffects('Choose a creature type. Draw a card for each permanent you control of that type.', 'X', true).mode).toBe('auto');
  });

  test('the lands: the tap, the colour clause and the colour it refuses', () => {
    const heath = faceOf(card('Thriving Heath'), 0);
    expect([heath.entersTapped, heath.choosesColorOnEntry, heath.entryColorExcept]).toEqual([{ unless: null }, true, 'W']);
    const sea = faceOf(card('Sea Gate'), 0);
    expect([sea.entersTapped, sea.choosesColorOnEntry, sea.entryColorExcept]).toEqual([{ unless: null }, true, 'U']);
    expect(faceOf(card('Thriving Moor'), 0).entryColorExcept).toBe('B');
    expect(faceOf(card('Grizzly Bears'), 0).entryColorExcept).toBeUndefined();
    // The Thriving line with no exclusion: the tap and the clause read, nothing refused.
    const haven = faceOf(card('Uncharted Haven'), 0);
    expect([haven.entersTapped, haven.choosesColorOnEntry, haven.entryColorExcept]).toEqual([{ unless: null }, true, undefined]);
  });

  test('the cards complete', () => {
    for (const name of [...SPELLS, ...LANDS, ...PLAIN]) expect(engineCompleteness(card(name).data), name).toEqual({ complete: true, leftover: [] });
  });
});

describe('D632 - the chosen type at resolution', () => {
  test('Distant Melody: the prompt as it resolves, a card for each permanent of the type named', () => {
    const { g, cast } = table('Distant Melody', ['Llanowar Elves', 'Llanowar Elves', 'Raging Goblin'], ['Llanowar Elves']);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    mana(g, 'UCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cast }));
    untilType(g);
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'chooseCreatureType') throw new Error('no prompt');
    expect([awaiting.player, awaiting.source, awaiting.resolving, awaiting.continuation?.effects.length]).toEqual(['p1', cast, true, 1]);
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Elf' }));
    settle(g);
    expect((g.state.zones.hand.p1 ?? []).length, 'the two Elves p1 controls - not the opponent' + "'" + 's').toBe(hand0 - 1 + 2);
    expect(zone(g, cast)).toBe('graveyard');
    expect(g.state.cards[cast]?.chosenType ?? null, 'nothing remembers the answer').toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Kindred Dominance: every creature but the type named is destroyed, both sides', () => {
    const { g, cast, p1, p2 } = table('Kindred Dominance', ['Llanowar Elves', 'Raging Goblin'], ['Llanowar Elves', 'Grizzly Bears']);
    mana(g, 'BBCCCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cast }));
    untilType(g);
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Elf' }));
    settle(g);
    expect([...p1, ...p2].map((id) => zone(g, id))).toEqual(['battlefield', 'graveyard', 'battlefield', 'graveyard']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Crippling Fear: -3/-3 to every creature not of the type named', () => {
    const { g, cast, p1, p2 } = table('Crippling Fear', ['Grizzly Bears'], ['Air Elemental', 'Grizzly Bears', 'Llanowar Elves']);
    mana(g, 'BBCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cast }));
    untilType(g);
    must(g.submit({ t: 'AnswerChooseCreatureType', player: 'p1', creatureType: 'Bear' }));
    settle(g);
    const [bears, air, theirBears, elves] = [p1[0], p2[0], p2[1], p2[2]] as [InstanceId, InstanceId, InstanceId, InstanceId];
    expect([pt(g, bears), pt(g, air), pt(g, theirBears)]).toEqual([[2, 2], [1, 1], [2, 2]]);
    expect(zone(g, elves), 'a 1/1 at -3/-3').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D632 - the colour other than', () => {
  const colours = (g: Game, id: InstanceId) => manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', { includeConditional: true }).filter((s) => s.card === id).flatMap((s) => s.outputs.map((o) => Object.entries(o.mana).filter(([, n]) => n > 0).map(([k]) => k).join(''))).sort();

  test('Thriving Heath: played tapped, white refused, the colour named tapped for beside its white', () => {
    const g = startedGame({ players: 2, decks: [['Thriving Heath', ...FILLER], [...FILLER]], options: { maxHandSize: null } });
    holdEverywhere(g);
    const heath = put(g, 'p1', 'Thriving Heath', 'hand');
    main(g, 3);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: heath }));
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'chooseColor') throw new Error('no prompt');
    expect(awaiting.except).toBe('W');
    const refused = g.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'W' });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe('excludedColor');
    expect(g.state.priority.awaiting?.kind).toBe('chooseColor');
    must(g.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'B' }));
    expect(g.state.cards[heath]?.chosenColor).toBe('B');
    expect(g.state.cards[heath]?.tapped).toBe(true);
    main(g, 5);
    expect(colours(g, heath)).toEqual(['B', 'W']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a Gate put onto the battlefield: the simplest answer skips the colour it refuses', () => {
    const g = startedGame({ players: 2, decks: [['Citadel Gate', ...FILLER], [...FILLER]], options: { maxHandSize: null } });
    holdEverywhere(g);
    const gate = put(g, 'p1', 'Citadel Gate');
    settle(g);
    expect(g.state.cards[gate]?.chosenColor, 'white excluded: the harness names blue').toBe('U');
  });
});

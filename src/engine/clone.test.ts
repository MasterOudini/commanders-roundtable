// D486 - THE CLONE (CR 707.9). `You may have ~ enter as a copy of any creature on the battlefield`: as the permanent
// enters, the replacement funnel HOLDS its move and asks its controller to name one of the candidates (public zones, so
// the ids ride the prompt as the legend rule's do) or to decline; the answer rewrites the held move (`asCopyOf`) and the
// card enters AS the copy - its identity fields become the copied card's, the printed card kept as `original` for the
// move that takes it off the battlefield. What is proven here: the parser's readings and refusals; Clone entering as a
// Wall of Omens DRAWS (the copied card's enters trigger fires, because the copy was decided before the entry); a
// declined Clone enters as itself, a 0/0 the state-based actions bin; Phyrexian Metamorph copying a countered Bears is
// an `Artifact Creature` 2/2 with no counter; a non-candidate is refused; a bounced copy is its printed card again;
// Vesuva enters tapped as a Forest; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEntersAsCopyLine } from '../data/replacementParse';
import { advanceUntil, deps, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { WALL_OF_OMENS_SCRIPT } from './scripts/cards/wallOfOmens';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const chars = (g: Game, id: InstanceId) => derive(g.state, deps().oracle, deps().scripts, id);
const asked = (g: Game) => { advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseCopy', 20_000); const a = g.state.priority.awaiting; if (a?.kind !== 'chooseCopy') throw new Error('no copy prompt'); return a; };

describe('D486 - the clone', () => {
  test('the parser reads the forms, the closed exceptions, and refuses the conditions', () => {
    const clone = parseEntersAsCopyLine('You may have this creature enter as a copy of any creature on the battlefield.', 'Clone');
    expect(clone).toMatchObject({ scope: 'any', other: false, zone: 'battlefield', tapped: false, exceptions: null, what: 'creature' });
    expect(clone?.predicates).toEqual([{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }]);
    const meta = parseEntersAsCopyLine("You may have this creature enter as a copy of any artifact or creature on the battlefield, except it's an artifact in addition to its other types.", 'Phyrexian Metamorph');
    expect(meta?.predicates).toHaveLength(2);
    expect(meta?.exceptions).toEqual({ addTypes: ['Artifact'] });
    expect(parseEntersAsCopyLine('You may have this land enter tapped as a copy of any land on the battlefield.', 'Vesuva')).toMatchObject({ tapped: true, scope: 'any' });
    expect(parseEntersAsCopyLine('You may have this creature enter as a copy of a creature you control.', 'Mirror Image')).toMatchObject({ scope: 'you', other: false });
    expect(parseEntersAsCopyLine('You may have Sakashima the Impostor enter as a copy of another creature you control, except it has Sakashima the Impostor\'s other abilities.', 'Sakashima the Impostor')).toBeNull();
    expect(parseEntersAsCopyLine('You may have this creature enter as a copy of any creature on the battlefield with mana value less than or equal to the amount of mana spent to cast this creature, except it\'s a Bird in addition to its other types.', 'Mockingbird')).toBeNull();
    expect(parseEntersAsCopyLine('Raid — If you attacked this turn, you may have this creature enter as a copy of any creature on the battlefield.', 'Protean Raider')).toBeNull();
    expect(parseEntersAsCopyLine('You may have this creature enter as a copy of any creature card in a graveyard.', 'Body Double')).toMatchObject({ zone: 'graveyard', scope: 'any' });
  });

  test('Clone entering as a Wall of Omens draws: the copied enters trigger fires', () => {
    const g = startedGame({ players: 2, decks: [['Clone', 'Grizzly Bears', 'Hill Giant', 'Coral Eel'], ['Wall of Omens', 'Grizzly Bears']], scripts: createRegistry([WALL_OF_OMENS_SCRIPT]) });
    holdEverywhere(g);
    const wall = put(g, 'p2', 'Wall of Omens');
    const clone = put(g, 'p1', 'Clone', 'hand');
    main3(g);
    const hand0 = (g.state.zones.hand.p1 ?? []).length - 1;
    mana(g, 'p1', 'CCCU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: clone, targets: [] }));
    const ask = asked(g);
    expect(ask.player).toBe('p1');
    expect(ask.candidates).toContain(wall);
    expect(ask.candidates).not.toContain(clone);
    expect(g.state.cards[clone]?.zone.kind, 'the move is held while the question stands').toBe('stack');
    must(g.submit({ t: 'AnswerChooseCopy', player: 'p1', source: clone, card: wall }));
    settle(g);
    expect(g.state.cards[clone]?.zone.kind).toBe('battlefield');
    expect(nameOf(g, clone)).toBe('Wall of Omens');
    expect(g.state.cards[clone]?.original).toBeDefined();
    expect((g.state.zones.hand.p1 ?? []).length, 'the copied Wall drew').toBe(hand0 + 1);
    // Bounced, it is a Clone again.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: clone, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(nameOf(g, clone)).toBe('Clone');
    expect(g.state.cards[clone]?.original).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a declined Clone enters as itself, a 0/0 the state-based actions bin; a non-candidate is refused', () => {
    const g = startedGame({ players: 2, decks: [['Clone', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const forest = put(g, 'p2', 'Forest');
    const clone = put(g, 'p1', 'Clone', 'hand');
    main3(g);
    mana(g, 'p1', 'CCCU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: clone, targets: [] }));
    const ask = asked(g);
    expect(ask.candidates).toEqual([bears]);
    expect(g.submit({ t: 'AnswerChooseCopy', player: 'p1', source: clone, card: forest }).ok).toBe(false);
    must(g.submit({ t: 'AnswerChooseCopy', player: 'p1', source: clone, card: null }));
    settle(g);
    expect(nameOf(g, clone)).toBe('Clone');
    expect(g.state.cards[clone]?.zone.kind, 'a 0/0 Clone dies to the state-based actions').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Phyrexian Metamorph copying a countered Bears is an Artifact Creature 2/2 with no counter', () => {
    const g = startedGame({ players: 2, decks: [['Phyrexian Metamorph', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: bears, kind: '+1/+1', delta: 1 }));
    const meta = put(g, 'p1', 'Phyrexian Metamorph', 'hand');
    main3(g);
    mana(g, 'p1', 'CCCU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: meta, targets: [] }));
    const ask = asked(g);
    must(g.submit({ t: 'AnswerChooseCopy', player: 'p1', source: meta, card: ask.candidates[0] as InstanceId }));
    settle(g);
    expect(nameOf(g, meta)).toBe('Grizzly Bears');
    const c = chars(g, meta);
    expect(c.typeLine.types).toEqual(['Artifact', 'Creature']);
    expect([c.power, c.toughness]).toEqual([2, 2]);
    expect(g.state.cards[meta]?.counters).toEqual({});
    expect(g.state.cards[meta]?.copyExceptions).toEqual({ addTypes: ['Artifact'] });
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Vesuva enters tapped as a copy of a Forest', () => {
    const g = startedGame({ players: 2, decks: [['Vesuva', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const forest = put(g, 'p2', 'Forest');
    const vesuva = put(g, 'p1', 'Vesuva', 'hand');
    main3(g);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: vesuva }));
    const ask = asked(g);
    expect(ask.candidates).toContain(forest);
    must(g.submit({ t: 'AnswerChooseCopy', player: 'p1', source: vesuva, card: forest }));
    settle(g);
    expect(nameOf(g, vesuva)).toBe('Forest');
    expect(g.state.cards[vesuva]?.tapped, 'the Vesuva form enters tapped').toBe(true);
    expect(chars(g, vesuva).typeLine.subtypes).toEqual(['Forest']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

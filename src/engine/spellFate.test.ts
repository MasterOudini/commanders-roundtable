// D501 - THE SPELL'S OWN FATE. `Exile ~.` / `Shuffle ~ into its owner's library.` / `Put ~ on the bottom of its owner's
// library.` as a spell's own sentence replaces CR 608.2n with the card's text: the resolving spell leaves the stack for
// exile, or its owner's library (shuffled in, or on the bottom), never the graveyard. The vocabulary parses the three
// as self kinds (`exileSelf`, `shuffleSelf`, `bottomSelf`); the executor leaves a source on the stack alone and
// `resolveTop` moves the card as it leaves the stack (the card is still on the stack while its clauses run, CR 608.2),
// the `StackResolved` event carrying the fate. What is proven here: the readings; Restock exiled after returning two
// cards (and put into the graveyard when it fizzles - CR 608.2b, the fate is part of a resolution that never happens);
// Beacon of Destruction shuffled into its owner's library after its damage (one `LibraryShuffled` over the library the
// card just joined, the RNG threaded through the log); Spell Crumple on the bottom of its owner's library under the
// spell it countered there; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { StackId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, self: e.self === true })) }; };
const resolvedWith = (g: Game) => g.log.filter((e) => e.body.t === 'StackResolved' && e.body.card !== null).map((e) => (e.body.t === 'StackResolved' ? { to: e.body.to?.kind, fate: e.body.fate } : null));

describe("D501 - the spell's own fate", () => {
  test('the readings: the three fates as self kinds, and the rest of each spell read beside them', () => {
    expect(kinds('Return two target cards from your graveyard to your hand. Exile ~.')).toEqual({ mode: 'auto', effects: [{ kind: 'returnFromGraveyard', self: false }, { kind: 'exileSelf', self: true }] });
    expect(kinds('Return target instant or sorcery card from your graveyard to your hand. Exile ~.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'returnFromGraveyard' }, { kind: 'exileSelf', self: true }] });
    expect(kinds("~ deals 5 damage to any target. Shuffle ~ into its owner's library.")).toEqual({ mode: 'auto', effects: [{ kind: 'damage', self: false }, { kind: 'shuffleSelf', self: true }] });
    expect(kinds("Create a 1/1 green Insect creature token for each Forest you control. Shuffle ~ into its owner's library.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'shuffleSelf', self: true }] });
    expect(kinds("Counter target spell. If that spell is countered this way, put it on the bottom of its owner's library instead of into that player's graveyard. Put ~ on the bottom of its owner's library.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'counter' }, { kind: 'bottomSelf', self: true }] });
  });

  test('Restock: the two cards come back to hand and the spell is exiled as it resolves; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Restock', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const a = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    const b = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    const restock = put(g, 'p1', 'Restock', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GGGGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: restock, targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind, 'returned to hand').toBe('hand');
    expect(g.state.cards[b]?.zone.kind, 'returned to hand').toBe('hand');
    expect(g.state.cards[restock]?.zone.kind, 'the spell is exiled, not put into the graveyard').toBe('exile');
    expect(resolvedWith(g), 'the resolution says where it went and why').toEqual([{ to: 'exile', fate: 'exile' }]);
    expect(g.log.some((e) => e.body.t === 'Narrated' && e.body.text.includes('is exiled as it resolves')), 'said out loud').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Restock whose targets are gone fizzles into the graveyard (CR 608.2b): the fate is part of a resolution that never happens', () => {
    const g = startedGame({ players: 2, decks: [['Restock', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const a = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    const b = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    const restock = put(g, 'p1', 'Restock', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GGGGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: restock, targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    // Both targets leave the graveyard in response.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: a, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: b, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'SpellFizzled'), 'countered on resolution').toBe(true);
    expect(g.state.cards[restock]?.zone.kind, 'a fizzled spell goes to the graveyard').toBe('graveyard');
    expect(resolvedWith(g), 'no resolution, no fate').toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Beacon of Destruction: five damage, then shuffled into its owner's library - one shuffle over the library it joined; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Beacon of Destruction', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const beacon = put(g, 'p1', 'Beacon of Destruction', 'hand');
    main(g, 3);
    const life0 = g.state.players.p2?.life ?? 0;
    const lib0 = (g.state.zones.library.p1 ?? []).length;
    const shuffles0 = g.log.filter((e) => e.body.t === 'LibraryShuffled' && e.body.player === 'p1').length;
    mana(g, 'p1', 'RRRRR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: beacon, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life, 'five damage').toBe(life0 - 5);
    expect(g.state.cards[beacon]?.zone.kind, "in its owner's library").toBe('library');
    const lib = g.state.zones.library.p1 ?? [];
    expect(lib.length, 'the library grew by the card').toBe(lib0 + 1);
    expect(lib.includes(beacon)).toBe(true);
    const shuffled = g.log.filter((e) => e.body.t === 'LibraryShuffled' && e.body.player === 'p1');
    expect(shuffled.length, 'exactly one shuffle for the fate').toBe(shuffles0 + 1);
    const last = shuffled[shuffled.length - 1]!.body;
    expect(last.t === 'LibraryShuffled' ? [...last.order].sort() : [], 'the shuffle is a permutation of the whole library, the card among it').toEqual([...lib].sort());
    expect(resolvedWith(g)).toEqual([{ to: 'library', fate: 'shuffle' }]);
    expect(g.log.some((e) => e.body.t === 'Narrated' && e.body.text.includes("is shuffled into its owner's library")), 'said out loud').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Spell Crumple: the countered spell goes to the bottom of its owner's library, and Spell Crumple under it; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Spell Crumple', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const crumple = put(g, 'p1', 'Spell Crumple', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    const spell = g.state.stack[g.state.stack.length - 1]?.id as StackId;
    expect(spell).toBeDefined();
    mana(g, 'p1', 'UUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: crumple, targets: [{ kind: 'stack', id: spell }] }));
    settle(g);
    const lib = g.state.zones.library.p1 ?? [];
    expect(g.state.cards[bears]?.zone.kind, 'the countered spell is in the library').toBe('library');
    expect(g.state.cards[crumple]?.zone.kind, 'and so is Spell Crumple').toBe('library');
    // The library is stored bottom-first: Spell Crumple, put on the bottom last, is under the spell it countered.
    expect(lib[0], 'Spell Crumple on the very bottom').toBe(crumple);
    expect(lib[1], 'the countered spell just above it').toBe(bears);
    expect(resolvedWith(g)).toEqual([{ to: 'library', fate: 'bottom' }]);
    expect(g.state.zones.battlefield.includes(bears), 'the Bears never resolved').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

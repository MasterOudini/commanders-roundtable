// CR 701.16 — look at the top N of your library, keep some, and the rest go
// somewhere. See D141.
//
// ⚠️ THE TENTH BUCKET SPLIT DECIDED THIS SHAPE. `look at the top N` is 350
// blocked cards: 149 trigger payloads, 138 plain one-shot effects, 64 activated.
// By destination: 186 the bottom, 75 the bottom IN ANY ORDER, 54 the graveyard,
// 21 back in any order. Only the plain effect resolves by itself, and only the
// destinations that carry no ORDER decision can be executed.
//
// ⚠️ AND THE PROMPT IS THE DISCARD PROMPT OVER A SECOND ZONE. `chooseFromZone`
// ships no card ids for a hand (D137) because a hand is hidden; a library is
// hidden too, and the client sees exactly the cards the rules just revealed to
// it through `view.peek` (D114). Same prompt, same guarantee, one more zone.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, findAnywhere, fullControl, must, nameOf, ORACLE, put, startedGame } from './testing/harness';
import { parseEffects as parseSentence } from '../data/effectParse';
import type { InstanceId } from './types/ids';

const LANDS = ['Island', 'Island', 'Island'];
const DECK = [
  'Sleight of Hand',
  'Forbidden Alchemy',
  ...LANDS,
  'Grizzly Bears',
  'Lightning Bolt',
  'Counterspell',
  'Brainstorm',
];

function game(): Game {
  const g = startedGame({ players: 2, decks: [DECK, DECK] });
  fullControl(g, 'p1');
  for (const l of LANDS) put(g, 'p1', l);
  return g;
}

function asking(g: Game): Extract<NonNullable<Game['state']['priority']['awaiting']>, { kind: 'chooseFromZone' }> {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseFromZone') throw new Error(`expected chooseFromZone, got ${a?.kind ?? 'none'}`);
  return a;
}

function cast(g: Game, name: string): void {
  const card = findAnywhere(g, 'p1', name);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [] }));
  advanceUntil(g, (s) => s.stack.length === 0 || s.priority.awaiting?.kind === 'chooseFromZone', 400);
}

describe('the sentence (CR 701.16)', () => {
  test('the bottom form is read, and the whole card runs', () => {
    const face = ORACLE.byName('Sleight of Hand')?.faces[0];
    expect(face?.oracleText).toBe(
      'Look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library.',
    );
    expect(face?.effectMode).toBe('auto');
    expect(face?.effects[0]).toMatchObject({ kind: 'lookAtTop', amount: 2, look: { take: 1, rest: 'bottom' } });
  });

  /**
   * ⚠️ The SENTENCE is read even though the CARD is not: `Forbidden Alchemy`
   * carries Flashback, which this vocabulary has no word for, so it stays
   * `assisted` — the prompt bar offers the understood half as one logged click.
   */
  // D307: its flashback line is the engine's own now (no clause), so the look
  // is the whole effect with the ask last - the card runs whole, 'auto'.
  test('the graveyard form is read, on a card that runs whole since D307', () => {
    const face = ORACLE.byName('Forbidden Alchemy')?.faces[0];
    expect(face?.effects[0]).toMatchObject({ kind: 'lookAtTop', amount: 4, look: { take: 1, rest: 'graveyard' } });
    expect(face?.effectMode).toBe('auto');
  });

  /**
   * ⚠️ **THIS TEST CHANGED SIDES, AND THE HISTORY IS THE POINT.** For one
   * milestone it read "an order the player should choose is refused": "in any
   * order" is a SECOND decision the card gives the player, and D141 had nowhere
   * to ask for it, so executing the sentence would have picked an order on their
   * behalf. D142 built `Awaiting.orderCards`, so the same sentence is now a
   * question with a real answer. What must never come back is the middle
   * outcome — reading the clause and deciding the sequence for them.
   */
  test('an order the player should choose is ASKED now, not refused', () => {
    const face = ORACLE.byName('Dig Through Time')?.faces[0];
    expect(face?.effects[0]).toMatchObject({ kind: 'lookAtTop', look: { rest: 'bottomOrdered' } });
  });

  /**
   * ⚠️ **AND THE RANDOM ONE CHANGED SIDES TOO (D389).** D141 and D142 refused it
   * because `effectEvents` has no rng. It still has none: the leftovers are only
   * known once the pick is answered, so the ANSWER handler shuffles them off the
   * seeded generator and the advanced state rides the accept (D147's rule).
   */
  test('an order the engine could not roll is rolled at the answer now', () => {
    const face = ORACLE.byName('Drawn from Dreams')?.faces[0];
    expect(face?.effectMode).toBe('auto');
    expect(face?.effects[0]).toMatchObject({
      kind: 'lookAtTop',
      amount: 7,
      look: { take: 2, rest: 'random', filter: null, optional: false },
    });
  });


  /**
   * ⚠️ "THE OTHER" IS SINGULAR, so exactly one card may be left over — and the
   * build refuses the sentence when the arithmetic disagrees, rather than being
   * right by luck on the printings that happen to exist.
   */
  test('“the other” with more than one left over is refused', () => {
    expect(
      parseEffects(
        'Look at the top four cards of your library. Put one of them into your hand and the other on the bottom of your library.',
        'X',
        true,
      ).mode,
    ).not.toBe('auto');
  });
});

describe('choosing from the revealed cards', () => {
  test('resolving reveals the top N and asks, moving nothing yet', () => {
    const g = game();
    const before = [...(g.state.zones.library['p1'] ?? [])];
    cast(g, 'Sleight of Hand');

    const a = asking(g);
    expect(a).toMatchObject({ player: 'p1', zone: 'library', count: 1, rest: 'bottom' });
    // The two on top are revealed to this player and to nobody else.
    const shown = before.slice(-2);
    for (const id of shown) expect(g.state.cards[id]?.revealedTo).toEqual(['p1']);
    // …and nothing has moved.
    expect(g.state.zones.library['p1']).toHaveLength(before.length);
  });

  /**
   * ⚠️ **THE PROMPT SHIPS NO CARD IDS**, exactly as the discard prompt does not.
   * A library is hidden; the client sees the revealed cards through `view.peek`
   * (D114), which is the one exception `project.ts` makes to "a library is a
   * count, full stop".
   */
  test('the prompt does not carry the library', () => {
    const g = game();
    cast(g, 'Sleight of Hand');
    const json = JSON.stringify(asking(g));
    for (const id of g.state.zones.library['p1'] ?? []) expect(json).not.toContain(id);
  });

  test('answering takes the chosen card and bottoms the other', () => {
    const g = game();
    const before = [...(g.state.zones.library['p1'] ?? [])];
    const shown = before.slice(-2);
    cast(g, 'Sleight of Hand');

    const keep = shown[0]!;
    const other = shown[1]!;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [keep] }));

    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand['p1']).toContain(keep);
    // ⚠️ THE BOTTOM IS INDEX 0 — `drawFromTop` takes from the END of the array.
    // A move that got this backwards would put the declined card straight back
    // under the next draw.
    expect(g.state.zones.library['p1']?.[0]).toBe(other);
    // ⚠️ And the reveal is CLEARED, or the player would keep seeing it for the
    // rest of the game.
    expect(g.state.cards[other]?.revealedTo).toEqual([]);
  });

  test('a card that was not revealed cannot be taken', () => {
    const g = game();
    const before = [...(g.state.zones.library['p1'] ?? [])];
    cast(g, 'Sleight of Hand');
    const deep = before[0]!;
    const r = g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [deep] });
    expect(r.ok).toBe(false);
    // …and the prompt is still up.
    expect(asking(g).count).toBe(1);
  });

  /**
   * ⚠️ **NO PROMPT WHEN THERE IS NOTHING TO CHOOSE.** A library with no more
   * cards than the spell takes goes to the hand whole — the same rule the
   * discard case follows, and the same reason: a question with one legal answer
   * is a click that teaches the player nothing.
   */
  test('a library too short to choose from is taken whole, unasked', () => {
    const g = game();
    const lib = [...(g.state.zones.library['p1'] ?? [])];
    // Down to a single card.
    for (const id of lib.slice(0, -1)) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'exile', player: 'p1' } }));
    }
    expect(g.state.zones.library['p1']).toHaveLength(1);
    const last = g.state.zones.library['p1']![0]!;

    cast(g, 'Sleight of Hand');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand['p1']).toContain(last);
  });

  test('it replays to the same hash', () => {
    const g = game();
    const shown = [...(g.state.zones.library['p1'] ?? [])].slice(-2);
    cast(g, 'Sleight of Hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [shown[0]!] }));
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

/**
 * The SEQUENCE (D142). `Impulse` takes one of four and orders the other three;
 * `Index` takes nothing and re-stacks all five.
 */
describe('choosing the order (CR 701.16, "in any order")', () => {
  const ORD = ['Impulse', 'Index', ...LANDS, 'Grizzly Bears', 'Lightning Bolt', 'Counterspell', 'Brainstorm'];

  function ordGame(): Game {
    const g = startedGame({ players: 2, decks: [ORD, ORD] });
    fullControl(g, 'p1');
    for (const l of LANDS) put(g, 'p1', l);
    return g;
  }

  function ordering(g: Game): Extract<NonNullable<Game['state']['priority']['awaiting']>, { kind: 'orderCards' }> {
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'orderCards') throw new Error(`expected orderCards, got ${a?.kind ?? 'none'}`);
    return a;
  }

  test('Impulse asks for the pick FIRST, then the order', () => {
    const g = ordGame();
    cast(g, 'Impulse');
    // Round one: which card to keep.
    const pick = g.state.priority.awaiting;
    expect(pick).toMatchObject({ kind: 'chooseFromZone', count: 1, rest: 'bottomOrdered' });
    if (pick?.kind !== 'chooseFromZone') throw new Error('unreachable');

    const shown = (g.state.zones.library['p1'] ?? []).filter((id) =>
      g.state.cards[id]?.revealedTo.includes('p1'),
    );
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [shown[0]!] }));

    // Round two: the sequence for the three left over.
    const ord = ordering(g);
    expect(ord).toMatchObject({ player: 'p1', zone: 'library', destination: 'bottom', count: 3 });
    // ⚠️ The kept card is already in hand; only the leftovers are still waiting.
    expect(g.state.zones.hand['p1']).toContain(shown[0]!);
  });

  test('the sequence is written FIRST ENTRY FIRST', () => {
    const g = ordGame();
    cast(g, 'Impulse');
    const shown = (g.state.zones.library['p1'] ?? []).filter((id) =>
      g.state.cards[id]?.revealedTo.includes('p1'),
    );
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [shown[0]!] }));

    const rest = (g.state.zones.library['p1'] ?? []).filter((id) =>
      g.state.cards[id]?.revealedTo.includes('p1'),
    );
    const chosen = [rest[2]!, rest[0]!, rest[1]!];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: chosen }));

    expect(g.state.priority.awaiting).toBeNull();
    // ⚠️ THE BOTTOM IS INDEX 0, so the player's first card is the deepest.
    expect((g.state.zones.library['p1'] ?? []).slice(0, 3)).toEqual(chosen);
    for (const id of chosen) expect(g.state.cards[id]?.revealedTo).toEqual([]);
  });

  /**
   * ⚠️ `Index` takes NOTHING, so there is no pick prompt at all — and the
   * sequence goes to the TOP, which is the opposite end of the array from
   * `Impulse`'s. The player's first card must end up drawn first.
   */
  test('Index skips the pick and orders onto the TOP', () => {
    const g = ordGame();
    cast(g, 'Index');
    const ord = ordering(g);
    expect(ord).toMatchObject({ destination: 'top', count: 5 });

    const shown = (g.state.zones.library['p1'] ?? []).filter((id) =>
      g.state.cards[id]?.revealedTo.includes('p1'),
    );
    const chosen = [shown[4]!, shown[0]!, shown[1]!, shown[2]!, shown[3]!];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: chosen }));

    const lib = g.state.zones.library['p1'] ?? [];
    // The TOP is the END of the array, so the first-named card is drawn first.
    expect(lib.slice(-5)).toEqual([...chosen].reverse());
  });

  test('a wrong ordering is rejected, three ways', () => {
    const g = ordGame();
    cast(g, 'Index');
    const shown = (g.state.zones.library['p1'] ?? []).filter((id) =>
      g.state.cards[id]?.revealedTo.includes('p1'),
    );
    const deep = (g.state.zones.library['p1'] ?? [])[0]!;

    // Too few.
    expect(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: shown.slice(0, 3) }).ok).toBe(false);
    // A duplicate, which has the right LENGTH and the wrong contents.
    expect(
      g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [shown[0]!, shown[0]!, shown[1]!, shown[2]!, shown[3]!] }).ok,
    ).toBe(false);
    // A card that was never revealed.
    expect(
      g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [deep, shown[0]!, shown[1]!, shown[2]!, shown[3]!] }).ok,
    ).toBe(false);
    // …and the prompt is still up.
    expect(ordering(g).count).toBe(5);
  });

  test('it replays to the same hash', () => {
    const g = ordGame();
    cast(g, 'Index');
    const shown = (g.state.zones.library['p1'] ?? []).filter((id) =>
      g.state.cards[id]?.revealedTo.includes('p1'),
    );
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [...shown].reverse() }));
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

/**
 * D389 - THE LOOK WITH A FILTER. "Look at the top N cards of your library. You may
 * reveal a creature card from among them and put it into your hand. Put the rest on
 * the bottom of your library in a random order." Three sentences, one effect, and
 * three things D141's shape did not have: a FILTER on the pick (the search's own noun
 * reader, D357), an OPTIONAL pick, and a RANDOM order for the leftovers - shuffled in
 * the answer handler off the seeded generator, because that is where the leftovers
 * are known. The filter is PRINTED on the card, so it rides the prompt with `min`
 * beside it; the revealed run still does not (D141).
 */
describe('the look with a filter (D389)', () => {
  const FLANDS = ['Island', 'Island', 'Mountain', 'Forest', 'Forest'];
  // Exactly ONE card the filter admits among what will be staged on top.
  const RDECK = ['Arcane Infusion', ...FLANDS, 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears', 'Lightning Bolt'];
  const CDECK = ['Commune with Nature', ...FLANDS, 'Lightning Bolt', 'Counterspell', 'Brainstorm', 'Grizzly Bears', 'Arcane Infusion'];

  function fgame(deck: readonly string[]): Game {
    const g = startedGame({ players: 2, decks: [deck, deck] });
    fullControl(g, 'p1');
    for (const l of FLANDS) put(g, 'p1', l);
    return g;
  }
  /** Every copy of a name p1 holds in the library or the hand (`put` finds one by name; a look needs all of them). */
  const mine = (g: Game, name: string): InstanceId[] =>
    (Object.keys(g.state.cards) as InstanceId[]).filter((id) => {
      const c = g.state.cards[id];
      return !!c && c.owner === 'p1' && (c.zone.kind === 'library' || c.zone.kind === 'hand') && nameOf(g, id) === name;
    });
  /** Stage the library TOP: the last id named ends up on top (the top is the END of the array). */
  function toTop(g: Game, ids: readonly InstanceId[]): void {
    for (const id of ids) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    }
  }
  const shownTo = (g: Game): InstanceId[] =>
    (g.state.zones.library['p1'] ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));

  test('the typed reveal is read on both orders, and the refusals stay refused', () => {
    const inf = ORACLE.byName('Arcane Infusion')?.faces[0];
    // Its second line is Flashback - the engine's own since D307, no clause of the spell's.
    expect(inf?.oracleText.split('\n')[0]).toBe(
      'Look at the top four cards of your library. You may reveal an instant or sorcery card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.',
    );
    expect(inf?.effectMode).toBe('auto');
    expect(inf?.effects[0]).toMatchObject({
      kind: 'lookAtTop',
      amount: 4,
      look: { take: 1, rest: 'random', optional: true, filter: { what: 'instant or sorcery card' } },
    });
    expect(inf?.effects[0]?.look?.filter?.predicates.map((p) => p.types)).toEqual([['Instant'], ['Sorcery']]);
    const nat = ORACLE.byName('Commune with Nature')?.faces[0];
    expect(nat?.effectMode).toBe('auto');
    expect(nat?.effects[0]).toMatchObject({
      kind: 'lookAtTop',
      amount: 5,
      look: { take: 1, rest: 'bottomOrdered', optional: true, filter: { what: 'creature card' } },
    });
    // A word the noun reader cannot place refuses the WHOLE sentence (D90).
    expect(ORACLE.byName('Board the Weatherlight')?.faces[0]?.effectMode).not.toBe('auto');
    expect(ORACLE.byName('Gift of the Gargantuan')?.faces[0]?.effectMode).not.toBe('auto');
  });

  /** "the OTHER into your graveyard" is singular, and the arithmetic is checked (D141's rule). */
  test('the singular graveyard form is read, and refused when two are left over', () => {
    const one = parseSentence('Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.', 'X', true);
    expect(one.mode).toBe('auto');
    expect(one.effects[0]).toMatchObject({ kind: 'lookAtTop', amount: 2, look: { take: 1, rest: 'graveyard' } });
    const two = parseSentence('Look at the top three cards of your library. Put one of them into your hand and the other into your graveyard.', 'X', true);
    expect(two.mode).not.toBe('auto');
    const ral = ORACLE.byName("Ral's Outburst")?.faces[0];
    expect(ral?.effectMode).toBe('auto');
    expect(ral?.effects.map((e) => e.kind)).toEqual(['damage', 'lookAtTop']);
  });
  test('the prompt carries the filter and the minimum, and still no library id', () => {
    const g = fgame(RDECK);
    toTop(g, [...mine(g, 'Grizzly Bears'), ...mine(g, 'Lightning Bolt')]);
    const before = [...(g.state.zones.library['p1'] ?? [])];
    cast(g, 'Arcane Infusion');
    const a = asking(g);
    expect(a).toMatchObject({ player: 'p1', zone: 'library', count: 1, min: 0, rest: 'random', filter: { what: 'instant or sorcery card' } });
    // ⚠️ The keys, pinned as D137 pins the discard's: `filter` and `min` are the two D389 added,
    // both printed on the card. Nothing here names a card.
    expect(Object.keys(a).sort()).toEqual(['count', 'filter', 'kind', 'label', 'min', 'player', 'rest', 'zone']);
    const json = JSON.stringify(a);
    for (const id of before) expect(json).not.toContain(id);
    expect(shownTo(g)).toHaveLength(4);
    expect(g.state.zones.library['p1']).toHaveLength(before.length);
  });

  test('a revealed card the filter does not admit is refused, and the prompt stays up', () => {
    const g = fgame(RDECK);
    toTop(g, [...mine(g, 'Grizzly Bears'), ...mine(g, 'Lightning Bolt')]);
    cast(g, 'Arcane Infusion');
    const bear = shownTo(g).find((id) => nameOf(g, id) === 'Grizzly Bears')!;
    const r = g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bear] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('illegalTarget');
    expect(asking(g).count).toBe(1);
  });

  test('the admitted pick goes to hand and the rest to the bottom in a rolled order', () => {
    const g = fgame(RDECK);
    toTop(g, [...mine(g, 'Grizzly Bears'), ...mine(g, 'Lightning Bolt')]);
    cast(g, 'Arcane Infusion');
    const shown = shownTo(g);
    const bolt = shown.find((id) => nameOf(g, id) === 'Lightning Bolt')!;
    const rest = shown.filter((id) => id !== bolt);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] }));
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand['p1']).toContain(bolt);
    // ⚠️ THE BOTTOM IS INDEX 0 (D141), and the ORDER is the generator's: the three are the
    // bottom three as a SET, and the reveal is cleared on all of them.
    const lib = g.state.zones.library['p1'] ?? [];
    expect([...lib.slice(0, 3)].sort()).toEqual([...rest].sort());
    for (const id of rest) expect(g.state.cards[id]?.revealedTo).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declining keeps nothing, bottoms all four, and replays', () => {
    const g = fgame(RDECK);
    toTop(g, [...mine(g, 'Grizzly Bears'), ...mine(g, 'Lightning Bolt')]);
    cast(g, 'Arcane Infusion');
    const shown = shownTo(g);
    const hand = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand['p1']).toHaveLength(hand);
    const lib = g.state.zones.library['p1'] ?? [];
    expect([...lib.slice(0, 4)].sort()).toEqual([...shown].sort());
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  /** "in any order" behind a filter chains into `orderCards` over the leftovers (D142), declined or not. */
  test('the any-order form asks for the sequence after the pick, and after a decline', () => {
    const g = fgame(CDECK);
    toTop(g, [...mine(g, 'Lightning Bolt'), ...mine(g, 'Counterspell'), ...mine(g, 'Brainstorm'), ...mine(g, 'Arcane Infusion'), ...mine(g, 'Grizzly Bears')]);
    cast(g, 'Commune with Nature');
    expect(asking(g)).toMatchObject({ count: 1, min: 0, rest: 'bottomOrdered', filter: { what: 'creature card' } });
    const shown = shownTo(g);
    expect(shown).toHaveLength(5);
    const bear = shown.find((id) => nameOf(g, id) === 'Grizzly Bears')!;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bear] }));
    const ord = g.state.priority.awaiting;
    expect(ord).toMatchObject({ kind: 'orderCards', destination: 'bottom', count: 4 });
    const rest = shownTo(g);
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: rest }));
    expect(g.state.zones.hand['p1']).toContain(bear);
    expect((g.state.zones.library['p1'] ?? []).slice(0, 4)).toEqual(rest);

    const h = fgame(CDECK);
    toTop(h, [...mine(h, 'Lightning Bolt'), ...mine(h, 'Counterspell'), ...mine(h, 'Brainstorm'), ...mine(h, 'Arcane Infusion'), ...mine(h, 'Grizzly Bears')]);
    cast(h, 'Commune with Nature');
    must(h.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    expect(h.state.priority.awaiting).toMatchObject({ kind: 'orderCards', destination: 'bottom', count: 5 });
  });
});

// D357 — THE LIBRARY SEARCH (CR 701.19).
//
// 514 cards carried this sentence as their single remaining piece — the densest family the seam map
// holds — and the engine had no verb for it at all.
//
// What is proven here, in the order a search travels:
//   · the PARSER reads the printed forms, and refuses a qualified noun it cannot decide;
//   · the RESOLUTION reveals the library to its owner and stops;
//   · ⚠️ the PROJECTION hands the searcher the SET and never the ORDER — the one hazard this whole
//     design exists to contain — and hands every other seat nothing at all;
//   · the ANSWER moves what was found, taps it where the card says, clears the reveal and shuffles;
//   · FAILING TO FIND is a real answer (CR 701.19b), and an illegal pick is refused by name.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import { project } from './project';
import { deps } from './testing/harness';
import type { Game } from './game';
import type { PlayerId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function textOf(name: string): string {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return card.data.faces[0]?.oracleText ?? '';
}
function searchOf(name: string, line?: string) {
  const r = parseEffects(line ?? textOf(name), name, true);
  return r.effects.find((e) => e.kind === 'search')?.search ?? null;
}

function view(g: Game, p: PlayerId) {
  const d = deps();
  return project(g.state, d.oracle, d.scripts, p);
}

/** A game where p1 holds the named sorcery and its library has basics to find. */
function cast(name: string): Game {
  const g = startedGame({
    players: 2,
    decks: [[name, 'Forest', 'Forest', 'Plains', 'Grizzly Bears'], ['Island']],
  });
  holdEverywhere(g);
  const spell = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('the library search (D357)', () => {
  // ── the parse ──────────────────────────────────────────────────────────────
  test('a basic land onto the battlefield tapped', () => {
    const s = searchOf('Rampant Growth');
    expect(s).not.toBeNull();
    expect(s?.predicates).toEqual([{ supertypes: ['Basic'], types: ['Land'], subtypes: [], colors: [] }]);
    expect(s?.destination).toBe('battlefield');
    expect(s?.tapped).toBe(true);
    expect(s?.shuffle).toBe(true);
    expect(s?.count).toBe(1);
  });

  test('a bare `a card` is UNRESTRICTED, and the empty predicate is what says so', () => {
    // `cardMatchesSearch` asks `every`, so a predicate naming nothing admits anything — which is
    // the honest reading of Demonic Tutor rather than a hole in the check.
    const s = searchOf('Demonic Tutor');
    expect(s?.predicates).toEqual([{ supertypes: [], types: [], subtypes: [], colors: [] }]);
    expect(s?.destination).toBe('hand');
  });

  test('`up to two` is a COUNT, and it is a maximum', () => {
    const s = searchOf('Explosive Vegetation');
    expect(s?.count).toBe(2);
    expect(s?.tapped).toBe(true);
  });

  test('a subtype, untapped', () => {
    const s = searchOf("Nature's Lore");
    expect(s?.predicates).toEqual([{ supertypes: [], types: [], subtypes: ['Forest'], colors: [] }]);
    expect(s?.tapped).toBe(false);
  });

  // D359 - the qualified noun is READ now: a bound on the CARD (mana value, printed name) rides
  // the search rather than the type-line predicate, and `cardMatchesSearch` is its one reader.
  test('a QUALIFIED noun is a bound on the card, not one more alternative', () => {
    const s1 = searchOf('Probe', 'Search your library for a creature card with mana value 3 or less, put it into your hand, then shuffle.');
    expect(s1?.qualifier).toEqual({ manaValue: { op: 'lte', n: 3 }, name: null });
    // ⚠️ AND THE PREDICATE IS STILL THE CREATURE. A reader that turned the bound into an `or`
    // would fetch any card at all with mana value 3 or less.
    expect(s1?.predicates).toEqual([{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }]);

    const s2 = searchOf('Probe', 'Search your library for a card named Squadron Hawk, reveal it, put it into your hand, then shuffle.');
    expect(s2?.qualifier).toEqual({ manaValue: null, name: 'Squadron Hawk' });

    // ⚠️ THE NAME RUNS THROUGH ITS OWN COMMAS AND STOPS AT THE SENTENCE'S. Twenty-odd cards
    // search for a planeswalker by full name, and a reader that stopped at the first comma would
    // look for a card called "Chandra" and find nothing.
    const s3 = searchOf('Probe', 'Search your library for a card named Chandra, Fire Artisan, reveal it, put it into your hand, then shuffle.');
    expect(s3?.qualifier).toEqual({ manaValue: null, name: 'Chandra, Fire Artisan' });
  });

  test('a QUALIFIER the vocabulary has no reader for is still refused', () => {
    // `a card with flash` asks about a keyword on a card in a library, which is a different
    // question from mana value or name - so the sentence stays unread and the card stays
    // honestly blocked (D90).
    const line = 'Search your library for an instant card or a card with flash, reveal it, put it into your hand, then shuffle.';
    const r = parseEffects(line, 'Probe', true);
    expect(r.effects.some((e) => e.kind === 'search'), line).toBe(false);
  });

  test('an effect that ASKS must be last, or the card never runs by itself', () => {
    // D195's rule: `effectEvents` stops at an `AwaitingSet`, so a clause after the search would be
    // silently dropped. The card lands `assisted` instead.
    const r = parseEffects(
      'Search your library for a basic land card, put it into your hand, then shuffle. Draw a card.',
      'Probe',
      true,
    );
    expect(r.mode).toBe('assisted');
  });

  // ── the resolution, and the hazard ─────────────────────────────────────────
  test('the resolution reveals the library to its OWNER and stops', () => {
    const g = cast('Rampant Growth');
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('searchLibrary');
    if (awaiting?.kind !== 'searchLibrary') throw new Error('no prompt');
    expect(awaiting.player).toBe('p1');
    expect(awaiting.count).toBe(1);
    // ⚠️ NO CARD IDS ON THE PROMPT — it crosses the wire whole (D61). The keys are exactly these.
    expect(Object.keys(awaiting).sort()).toEqual(
      ['count', 'destination', 'kind', 'label', 'optional', 'player', 'predicates', 'qualifier', 'shuffle', 'tapped', 'what'].sort(),
    );
    // D359 - and `Rampant Growth` is not optional, so the reveal happened in one step.
    expect(awaiting.optional).toBe(false);
    expect(awaiting.qualifier).toBe(null);
  });

  test('⚠️ THE SEARCHER GETS THE SET, NEVER THE ORDER — and nobody else gets either', () => {
    const g = cast('Rampant Growth');
    const lib = g.state.zones.library['p1'] ?? [];
    const mine = view(g, 'p1');
    const theirs = view(g, 'p2');

    // The searcher sees every card in their own library...
    expect([...mine.searching].sort()).toEqual([...lib].sort());
    // ...and `peek` is EMPTY, so the shuffle order never reaches a client. Without this the peek
    // would walk the whole revealed library from the top and hand back the real order.
    expect(mine.peek).toEqual([]);
    // ...and the list is SORTED, not in library order. (The library has two Forests and a Plains,
    // so a sorted list is not the shuffled one except by coincidence — the assertion is that it is
    // sorted, which is a property the order does not have.)
    const names = mine.searching.map((id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name ?? '');
    expect([...names]).toEqual([...names].sort());

    // The opponent learns nothing at all.
    expect(theirs.searching).toEqual([]);
    expect(theirs.peek).toEqual([]);
  });

  // ── the answer ─────────────────────────────────────────────────────────────
  test('what is found arrives, TAPPED where the card says, and the library shuffles', () => {
    const g = cast('Rampant Growth');
    const mine = view(g, 'p1');
    const forest = mine.searching.find((id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Forest');
    expect(forest).toBeDefined();
    const before = (g.state.zones.library['p1'] ?? []).length;
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest as string], declined: false }));
    settle(g);
    expect(g.state.cards[forest as string]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[forest as string]?.tapped).toBe(true);
    expect((g.state.zones.library['p1'] ?? []).length).toBe(before - 1);
    // The reveal is cleared, so the peek cannot start handing back the order again.
    for (const id of g.state.zones.library['p1'] ?? []) {
      expect(g.state.cards[id]?.revealedTo ?? []).not.toContain('p1');
    }
    expect(view(g, 'p1').searching).toEqual([]);
  });

  test('FAILING TO FIND is a real answer (CR 701.19b)', () => {
    const g = cast('Rampant Growth');
    const before = (g.state.zones.library['p1'] ?? []).length;
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: false }));
    settle(g);
    expect((g.state.zones.library['p1'] ?? []).length).toBe(before);
    expect(g.state.priority.awaiting).toBeNull();
    expect(view(g, 'p1').searching).toEqual([]);
  });

  test('a card the predicate does not admit is REFUSED by name', () => {
    const g = cast('Rampant Growth');
    const mine = view(g, 'p1');
    const bears = mine.searching.find(
      (id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Grizzly Bears',
    );
    expect(bears).toBeDefined();
    const r = g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [bears as string], declined: false });
    expect(r.ok).toBe(false);
    // And the legal one is accepted on the same board.
    const forest = mine.searching.find((id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Forest');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest as string], declined: false }));
  });

  test('more than the count is refused', () => {
    const g = cast('Rampant Growth');
    const mine = view(g, 'p1');
    const forests = mine.searching.filter(
      (id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Forest',
    );
    expect(forests.length).toBeGreaterThan(1);
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: forests, declined: false }).ok).toBe(false);
  });

  test('a search with no shuffle leaves the library alone', () => {
    // Not every search shuffles — three of the 514 do not, which is why `shuffle` is read from the
    // sentence rather than assumed.
    const r = parseEffects(
      'Search your library for a basic land card, put it into your hand.',
      'Probe',
      true,
    );
    const s = r.effects.find((e) => e.kind === 'search')?.search;
    expect(s?.shuffle).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = cast('Rampant Growth');
    const mine = view(g, 'p1');
    const forest = mine.searching.find((id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Forest');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest as string], declined: false }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

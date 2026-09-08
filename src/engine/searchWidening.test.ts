// D359 — THE OPTIONAL SEARCH, THE QUALIFIED CARD, AND THE TUTOR'S TOP.
//
// D357 gave the engine the verb and D358 drained its wave; 419 cards still carried a search their
// sentence could not read. Four clauses were measured over them, one at a time, by the cards that
// would LAND:
//
//   you may search ...............  24 ->  65 payloads read (the trigger heads, almost all of them)
//   a qualified card .............  24 ->  43 (the activated heads — the Rebel/Mercenary chains)
//   shuffle and put it on top ....  24 ->  28 (the tutors)
//   reveal that card .............  +0 alone, and it is in because the other three need it
//
// What is proven here, in the order the widening travels:
//   · the PARSER reads the four clauses, and still refuses a qualifier it cannot decide;
//   · ⚠️ the OPTIONAL search is asked in TWO STAGES, and the first shows nothing — the one piece of
//     this decision that is a design rather than a widening;
//   · the QUALIFIER is enforced at the answer, on the card rather than on its type line;
//   · the TUTOR moves nothing: the library is shuffled and the found card is put back on top.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import { createRegistry } from './scripts/registryCore';
import { project } from './project';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { FARHAVEN_ELF, TREASURE_MAGE } from '../data/fixtures/engineCards';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { PlayerId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function searchOf(name: string, line: string) {
  const r = parseEffects(line, name, true);
  return r.effects.find((e) => e.kind === 'search')?.search ?? null;
}

/**
 * ⚠️ TWO TEST-ONLY SCRIPTS, and they are the D358 row shape verbatim: a trigger whose payload is
 * the printed sentence, run through `ctx.vocabulary`. Neither card ships — both sit in the offer
 * stream this decision refilled — so the seam is proven on the real printed text without claiming
 * a coverage number the wave has not landed yet (the `cardScripts.ts` precedent).
 */
function trigger(card: typeof FARHAVEN_ELF, payload: string, label: string): CardScript {
  const effects = vocabularyEffects(payload, card.name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: card.name,
    triggers: [
      {
        abilityId: 'etb-0',
        text: card.faces[0]?.oracleText ?? '',
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) =>
          ev.t === 'CardsMoved' &&
          ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        label: () => label,
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}

const ELF = trigger(
  FARHAVEN_ELF,
  'You may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  'Farhaven Elf - you may search for a basic land',
);
const MAGE = trigger(
  TREASURE_MAGE,
  'You may search your library for an artifact card with mana value 6 or greater, reveal it, put it into your hand, then shuffle.',
  'Treasure Mage - you may search for a big artifact',
);
const SCRIPTS = createRegistry([ELF, MAGE]);

function view(g: Game, p: PlayerId) {
  const d = deps(SCRIPTS);
  return project(g.state, d.oracle, d.scripts, p);
}

/**
 * ⚠️ **THE CARD A SEARCH MUST FIND IS STAGED, NOT HOPED FOR.** `put()` deals from the LISTED
 * deck and the opening seven come out of a padded thirty (D232), so a named card is as likely to
 * be in hand as in the library. D358's whole wave staged for the same reason; a hand-written test
 * owes it too, and adding deck copies would be gambling on a shuffle.
 */
function stage(g: Game, name: string): void {
  for (const id of Object.keys(g.state.cards)) {
    const inst = g.state.cards[id];
    if (!inst || inst.owner !== 'p1' || inst.zone.kind === 'library') continue;
    if (ORACLE.byPrinting(inst.printingId)?.name !== name) continue;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' } }));
    return;
  }
}

/** A game where p1's creature has just entered and its optional search is asking. */
function enters(name: string, deck: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[name, ...deck], ['Island']], scripts: SCRIPTS });
  holdEverywhere(g);
  const card = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return g;
}

describe('the widened search (D359)', () => {
  // ── the parse ──────────────────────────────────────────────────────────────
  test('`you may search` is an OPTIONAL search, not a search that may find nothing', () => {
    const s = searchOf('Probe', 'You may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.');
    expect(s?.optional).toBe(true);
    expect(s?.destination).toBe('battlefield');
    expect(s?.tapped).toBe(true);
    // ⚠️ And a search that is NOT optional says so, or every search would ask twice.
    expect(searchOf('Probe', 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.')?.optional).toBe(false);
  });

  test('`reveal that card` is the same clause as `reveal it`', () => {
    const s = searchOf('Probe', 'Search your library for a creature card, reveal that card, put it into your hand, then shuffle.');
    expect(s?.destination).toBe('hand');
    expect(s?.predicates).toEqual([{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }]);
  });

  test('the TUTOR puts the card back on top, and the shuffle is printed in the middle of it', () => {
    const s = searchOf('Mystical Tutor', 'Search your library for an instant or sorcery card, reveal it, then shuffle and put that card on top.');
    expect(s?.destination).toBe('libraryTop');
    expect(s?.count).toBe(1);
    // The shuffle is not optional in this shape — it is printed between the search and the put.
    expect(s?.shuffle).toBe(true);
  });

  // ── the optional search, in two stages ─────────────────────────────────────
  test('⚠️ THE OFFER SHOWS NOTHING — the library is not revealed until it is accepted', () => {
    const g = enters('Farhaven Elf', ['Forest', 'Forest', 'Plains', 'Grizzly Bears']);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('searchLibrary');
    if (awaiting?.kind !== 'searchLibrary') throw new Error('no prompt');
    expect(awaiting.optional).toBe(true);
    // Nothing is revealed: a player who could look and then decline would keep what they saw AND
    // skip the shuffle that was meant to bury it.
    expect(view(g, 'p1').searching).toEqual([]);
    expect(view(g, 'p1').peek).toEqual([]);
  });

  test('DECLINING looks at nothing, moves nothing and shuffles nothing', () => {
    const g = enters('Farhaven Elf', ['Forest', 'Forest', 'Plains', 'Grizzly Bears']);
    const before = [...(g.state.zones.library['p1'] ?? [])];
    const at = g.log.length;
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: true }));
    expect(g.state.priority.awaiting).toBe(null);
    // The library is untouched — the same cards in the same order.
    expect(g.state.zones.library['p1']).toEqual(before);
    const kinds = g.log.slice(at).map((e) => e.body.t);
    expect(kinds).not.toContain('LibraryShuffled');
    expect(kinds).not.toContain('CardsRevealed');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('ACCEPTING reveals the library and asks again — and the second prompt is the search', () => {
    const g = enters('Farhaven Elf', ['Forest', 'Forest', 'Plains', 'Grizzly Bears']);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: false }));
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'searchLibrary') throw new Error('no second prompt');
    expect(awaiting.optional).toBe(false);
    const mine = view(g, 'p1');
    expect(mine.searching.length).toBe((g.state.zones.library['p1'] ?? []).length);
    expect(mine.peek).toEqual([]);
    // The opponent still learns nothing at all.
    expect(view(g, 'p2').searching).toEqual([]);

    const forest = mine.searching.find(
      (id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Forest',
    );
    if (!forest) throw new Error('no Forest to find');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest], declined: false }));
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'battlefield', player: 'p1' });
    expect(g.state.cards[forest]?.tapped).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an optional prompt takes no cards, and a plain search takes no decline', () => {
    const g = enters('Farhaven Elf', ['Forest', 'Forest', 'Plains', 'Grizzly Bears']);
    const lib = g.state.zones.library['p1'] ?? [];
    const first = lib[0];
    if (!first) throw new Error('no library');
    // Naming a card before looking is not an answer to the offer.
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [first], declined: false }).ok).toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: false }));
    // And declining is not an answer to the search itself.
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: true }).ok).toBe(false);
  });

  // ── the qualifier, enforced on the card ────────────────────────────────────
  test('a MANA VALUE bound is asked of the card, not of its type line', () => {
    const g = enters('Treasure Mage', ['Spine of Ish Sah', 'Sol Ring', 'Forest', 'Forest']);
    stage(g, 'Spine of Ish Sah');
    stage(g, 'Sol Ring');
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'searchLibrary') throw new Error('no prompt');
    expect(awaiting.qualifier).toEqual({ manaValue: { op: 'gte', n: 6 }, name: null });
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: false }));

    const mine = view(g, 'p1');
    const nameOf = (id: string) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name ?? '';
    const sol = mine.searching.find((id) => nameOf(id) === 'Sol Ring');
    const spine = mine.searching.find((id) => nameOf(id) === 'Spine of Ish Sah');
    if (!sol || !spine) throw new Error('the fixtures are not in the library');

    // ⚠️ Sol Ring IS an artifact card — the type line admits it and the bound does not.
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [sol], declined: false }).ok).toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [spine], declined: false }));
    expect(g.state.cards[spine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
  });

  // ── the tutor ──────────────────────────────────────────────────────────────
  test('⚠️ THE TUTOR MOVES NOTHING: the library is shuffled and the card put back on top', () => {
    const g = startedGame({
      players: 2,
      decks: [['Mystical Tutor', 'Counterspell', 'Forest', 'Forest', 'Plains'], ['Island']],
      scripts: SCRIPTS,
    });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Mystical Tutor', 'hand');
    // ⚠️ Staged BEFORE the cast: a card moved into the library while the search is already up
    // would never be revealed, and the searcher could not name it.
    stage(g, 'Counterspell');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);

    const mine = view(g, 'p1');
    const nameOf = (id: string) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name ?? '';
    const counter = mine.searching.find((id) => nameOf(id) === 'Counterspell');
    if (!counter) throw new Error('no Counterspell to find');
    const before = (g.state.zones.library['p1'] ?? []).length;

    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [counter], declined: false }));

    const after = g.state.zones.library['p1'] ?? [];
    // Nothing left the library, and the found card is its LAST entry — the array is bottom-first,
    // so the last entry is the top card.
    expect(after.length).toBe(before);
    expect(after[after.length - 1]).toBe(counter);
    expect(g.state.cards[counter]?.zone).toEqual({ kind: 'library', player: 'p1' });
    // ⚠️ Its reveal is NOT cleared: knowing what is on top is the whole effect of a tutor, and
    // `view.peek` reads exactly the revealed run from the top.
    expect(view(g, 'p1').peek).toEqual([counter]);
    expect(view(g, 'p2').peek).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

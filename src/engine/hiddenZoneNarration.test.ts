// CR 400.2 - a library and a hand are hidden zones, and the narration is ONE shared log every seat reads (only events
// and views are redacted per seat). The Tier-3 move named its card whatever zones it moved between and put the card's
// colours on the row: the tools drawer's "Look at top N" - a peek shown to its peeker alone - named each card it sent
// to the library's bottom or to hand ("Ana moves Lightning Bolt to their library."), and the card menu's "Move to"
// named a hand card put into a library, to the whole table. Every other tool whose line names a card (a counter, a tap,
// a P/T, a transform, control, the commander flag, an attachment) did the same for a card in a hand. What is proven
// here, on EVERY seat's projected log rows (the actor's own in the second person): a card is "a card", with no colours,
// unless every seat sees it where it stood or where it lands; a move with a public end still names it, with its
// colours; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { project } from './project';
import { find, holdEverywhere, idsIn, must, nameOf, ORACLE, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { PlayerId } from './types/ids';

const BOLT = 'Lightning Bolt';
const BEARS = 'Grizzly Bears';
const ANGEL = 'Serra Angel';
const PACIFISM = 'Pacifism';
const DELVER = 'Delver of Secrets // Insectile Aberration';
/** Ana's library for the peeks: coloured cards only, so whatever is on top has a name and colours to leak. */
const COLOURED = [BOLT, BEARS, 'Counterspell', ANGEL, 'Doom Blade'];
/** A 30-card library cycling through `names`. */
const deck = (names: readonly string[]) => Array.from({ length: 30 }, (_, i) => names[i % names.length] as string);
const OTHERS = ['p2', 'p3', 'p4'] as const;

const view = (g: Game, seat: PlayerId) => project(g.state, ORACLE, g.deps.scripts, seat);
/** The newest narration line's id: a test reads the lines after it. */
const mark = (g: Game) => g.state.narration[g.state.narration.length - 1]?.id ?? -1;
/** The lines after `from` as `seat` reads them: its projected rows (second person for its own lines) and colours. */
const rows = (g: Game, from: number, seat: PlayerId) => view(g, seat).log.filter((e) => e.id > from).map((e) => ({ text: e.text, identity: e.identity }));
const texts = (g: Game, from: number, seat: PlayerId) => rows(g, from, seat).map((r) => r.text);
/** No seat reads any of `names`, and no row carries a colour. */
function namesNothing(g: Game, from: number, names: readonly string[]): void {
  for (const seat of g.state.seating) {
    const read = rows(g, from, seat);
    expect(read.length, `${seat} reads the lines`).toBeGreaterThan(0);
    for (const r of read) {
      for (const name of names) expect(r.text, `${seat} reads "${r.text}"`).not.toContain(name);
      expect(r.identity, `the colours on ${seat}'s "${r.text}"`).toEqual([]);
    }
  }
}

describe('CR 400.2 - the log names a card only where every seat sees it', () => {
  test('peek at the top two, then both to the bottom: no seat reads either card', () => {
    const g = startedGame({ decks: [deck(COLOURED)] });
    holdEverywhere(g);
    const from = mark(g);
    must(g.submit({ t: 'ManualPeekLibrary', player: 'p1', count: 2 }));
    const peeked = view(g, 'p1').peek;
    expect(peeked).toHaveLength(2);
    // The peek panel's "Bottom", card by card (LibraryPanels.tsx `toBottom`).
    for (const card of peeked) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' }, placement: 'bottom' }));
    expect(idsIn(g, 'p1', 'library').slice(0, 2).sort(), 'both on the bottom').toEqual([...peeked].sort());
    expect(view(g, 'p1').peek, 'the panel has nothing left to show').toEqual([]);
    expect(texts(g, from, 'p1')).toEqual([
      'You look at the top 2 cards of your library.',
      'You move a card to their library.',
      'You move a card to their library.',
    ]);
    for (const seat of OTHERS) {
      expect(texts(g, from, seat)).toEqual([
        'Ana looks at the top 2 cards of their library.',
        'Ana moves a card to their library.',
        'Ana moves a card to their library.',
      ]);
    }
    namesNothing(g, from, COLOURED);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('peek at the top card, then to hand: its peeker holds it, and no seat reads what it is', () => {
    const g = startedGame({ decks: [deck(COLOURED)] });
    holdEverywhere(g);
    const from = mark(g);
    must(g.submit({ t: 'ManualPeekLibrary', player: 'p1', count: 1 }));
    const [card] = view(g, 'p1').peek;
    if (card === undefined) throw new Error('the peek showed nothing');
    const name = nameOf(g, card);
    // The peek panel's "Hand" (LibraryPanels.tsx `toHand`).
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
    expect(idsIn(g, 'p1', 'hand')).toContain(card);
    expect(texts(g, from, 'p1')).toEqual(['You look at the top 1 card of your library.', 'You move a card to their hand.']);
    for (const seat of OTHERS) expect(texts(g, from, seat)).toEqual(['Ana looks at the top 1 card of their library.', 'Ana moves a card to their hand.']);
    namesNothing(g, from, COLOURED);
    // Its peeker's view shows the card in hand; nothing in anyone else's names it.
    expect(view(g, 'p1').cards[card]?.card?.name).toBe(name);
    for (const seat of OTHERS) expect(JSON.stringify(view(g, seat)), `${seat}'s view`).not.toContain(name);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a hand card put into a library, by its owner and by an opponent: no seat reads it, and no row carries its colours', () => {
    const g = startedGame({ decks: [deck([ANGEL, BOLT])] });
    holdEverywhere(g);
    const angel = put(g, 'p1', ANGEL, 'hand');
    const bolt = put(g, 'p1', BOLT, 'hand');
    const from = mark(g);
    // The card menu's "Move to: Library" (ManualTools.tsx): the owner's library, no placement.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'library', player: 'p1' } }));
    // An opponent, who cannot see the hand, does the same to another card in it.
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bolt, to: { kind: 'library', player: 'p1' } }));
    expect([g.state.cards[angel]?.zone.kind, g.state.cards[bolt]?.zone.kind]).toEqual(['library', 'library']);
    expect(texts(g, from, 'p1')).toEqual(['You move a card to their library.', 'Ben moves a card to their library.']);
    expect(texts(g, from, 'p2')).toEqual(['Ana moves a card to their library.', 'You move a card to their library.']);
    for (const seat of ['p3', 'p4'] as const) expect(texts(g, from, seat)).toEqual(['Ana moves a card to their library.', 'Ben moves a card to their library.']);
    namesNothing(g, from, [ANGEL, BOLT]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a move with a public end still names its card, with its colours, to every seat', () => {
    const g = startedGame({ decks: [deck([BEARS, BOLT])] });
    holdEverywhere(g);
    const bears = put(g, 'p1', BEARS, 'hand');
    const bolt = find(g, 'p1', 'library', BOLT);
    const from = mark(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'battlefield', player: 'p1' } })); // lands public
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 })); // worked where it is public
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } })); // leaves a public zone
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'graveyard', player: 'p1' } })); // lands public
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'library', player: 'p1' } })); // leaves a public zone
    const colours = [['G'], ['G'], ['G'], ['R'], ['R']];
    expect(rows(g, from, 'p1')).toEqual(
      [
        'You move Grizzly Bears to the battlefield.',
        'You add 1 +1/+1 counter to Grizzly Bears.',
        'You move Grizzly Bears to their hand.',
        'You move Lightning Bolt to the graveyard.',
        'You move Lightning Bolt to their library.',
      ].map((text, i) => ({ text, identity: colours[i] })),
    );
    for (const seat of OTHERS) {
      expect(rows(g, from, seat)).toEqual(
        [
          'Ana moves Grizzly Bears to the battlefield.',
          'Ana adds 1 +1/+1 counter to Grizzly Bears.',
          'Ana moves Grizzly Bears to their hand.',
          'Ana moves Lightning Bolt to the graveyard.',
          'Ana moves Lightning Bolt to their library.',
        ].map((text, i) => ({ text, identity: colours[i] })),
      );
    }
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("an opponent works a card in Ana's hand with every tool whose line names a card: no seat reads it", () => {
    const g = startedGame({ decks: [deck([ANGEL, PACIFISM, DELVER]), deck([BEARS])] });
    holdEverywhere(g);
    const angel = put(g, 'p1', ANGEL, 'hand');
    const pacifism = put(g, 'p1', PACIFISM, 'hand');
    const delver = put(g, 'p1', DELVER, 'hand');
    const bears = put(g, 'p2', BEARS);
    const from = mark(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: angel, kind: '+1/+1', delta: 1 }));
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [angel], tapped: true }));
    must(g.submit({ t: 'ManualSetPt', player: 'p2', card: angel, power: 4, toughness: 4 }));
    must(g.submit({ t: 'ManualSetPt', player: 'p2', card: angel, power: null, toughness: null }));
    must(g.submit({ t: 'ManualFlipFace', player: 'p2', card: delver }));
    must(g.submit({ t: 'ManualSetController', player: 'p2', card: angel, controller: 'p1' }));
    must(g.submit({ t: 'ManualSetCommander', player: 'p2', card: angel, isCommander: true }));
    must(g.submit({ t: 'ManualSetCommander', player: 'p2', card: angel, isCommander: false }));
    must(g.submit({ t: 'ManualAttach', player: 'p2', card: pacifism, to: bears }));
    must(g.submit({ t: 'ManualAttach', player: 'p2', card: pacifism, to: null }));
    const said = [
      'Ben adds 1 +1/+1 counter to a card.',
      'Ben taps a card.',
      'Ben sets a card to 4/4.',
      'Ben clears the power/toughness override on a card.',
      'Ben transforms a card.',
      'Ben gives control of a card to Ana.',
      'Ben makes a card a commander.',
      'Ben stops treating a card as a commander.',
      'Ben attaches a card to Grizzly Bears.',
      'Ben unattaches a card.',
    ];
    expect(g.state.narration.filter((l) => l.id > from).map((l) => l.text), 'the canonical log').toEqual(said);
    expect(texts(g, from, 'p2')).toEqual([
      'You add 1 +1/+1 counter to a card.',
      'You tap a card.',
      'You set a card to 4/4.',
      'You clear the power/toughness override on a card.',
      'You transform a card.',
      'You give control of a card to Ana.',
      'You make a card a commander.',
      'You stop treating a card as a commander.',
      'You attach a card to Grizzly Bears.',
      'You unattach a card.',
    ]);
    expect(texts(g, from, 'p1')).toEqual(said.map((line) => line.replace('to Ana.', 'to you.')));
    for (const seat of ['p3', 'p4'] as const) expect(texts(g, from, seat)).toEqual(said);
    namesNothing(g, from, [ANGEL, PACIFISM, 'Delver of Secrets', 'Insectile Aberration']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

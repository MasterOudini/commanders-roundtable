// CR 400.2 - the assisted-effect tool (`ManualApplyEffect`) prints its card's name, its colours and its effects into
// the ONE shared log every seat reads. The UI offers it only for a spell its caster has just watched resolve, but a
// hand-built intent could name ANY instance id - an opponent's hand card (a view carries its id, never its data) or a
// library card - and the log then named that hidden card to the table and ran its effects. What is proven here: a hidden
// card applies only from the actor's OWN hand; an opponent's hand card and any library card (its owner's included) are
// refused with one answer whatever the card is (an assisted spell and a land alike), with no event and no row on any
// seat; the owner still applies a card from their own hand - the stand-in for a bought-back spell (CR 702.27a; no
// Commander-legal buyback spell is assisted today): cast, resolved, put back in hand by a Tier-3 move, then applied,
// named with its colours on every seat's rows. The replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { project } from './project';
import { advanceUntil, find, holdEverywhere, idsIn, must, ORACLE, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

/** A {1}{U} instant: "Draw a card." is the part the app understands; "Each opponent gets a poison counter." is not. */
const ASSISTED = 'Prologue to Phyresis';
const OTHERS = ['p2', 'p3', 'p4'] as const;

const view = (g: Game, seat: PlayerId) => project(g.state, ORACLE, g.deps.scripts, seat);
/** The newest narration line's id: a test reads the lines after it. */
const mark = (g: Game) => g.state.narration[g.state.narration.length - 1]?.id ?? -1;
/** The lines after `from` as `seat` reads them: its projected rows (second person for its own lines) and colours. */
const rows = (g: Game, from: number, seat: PlayerId) => view(g, seat).log.filter((e) => e.id > from).map((e) => ({ text: e.text, identity: e.identity }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game) =>
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);

/** The file's premise: the parser reads this card IN PART, so it is a card the assisted offer is raised for. */
function assistedSpell(): void {
  const face = ORACLE.byName(ASSISTED)?.faces[0];
  expect(face?.effectMode, `${ASSISTED} is an assisted spell`).toBe('assisted');
  expect(face?.effects.map((e) => e.kind)).toEqual(['draw']);
}

/** A refused apply: `wrongZone`, and no event, no state change and no row on any seat. */
function refused(g: Game, player: PlayerId, card: InstanceId): void {
  const events = g.log.length;
  const hash = g.hash();
  const from = mark(g);
  const result = g.submit({ t: 'ManualApplyEffect', player, card, targets: [] });
  expect(result.ok, `${player} applies ${card}`).toBe(false);
  if (!result.ok) expect(result.reason).toBe('wrongZone');
  expect(g.log.length, 'no event').toBe(events);
  expect(g.hash(), 'no state change').toBe(hash);
  for (const seat of g.state.seating) expect(rows(g, from, seat), `${seat}'s rows`).toEqual([]);
}

describe('CR 400.2 - the assisted-effect tool never applies a card the table cannot see', () => {
  test("an opponent's hand card is refused - the same refusal for an assisted spell and a land", () => {
    assistedSpell();
    const g = startedGame({ decks: [[ASSISTED]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', ASSISTED, 'hand');
    const land = put(g, 'p1', 'Island', 'hand');
    refused(g, 'p2', spell);
    refused(g, 'p2', land);
    expect(g.state.cards[spell]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a library card is refused, its owner included', () => {
    assistedSpell();
    const g = startedGame({ decks: [Array.from({ length: 15 }, () => ASSISTED)] });
    holdEverywhere(g);
    const spell = find(g, 'p1', 'library', ASSISTED);
    refused(g, 'p1', spell);
    refused(g, 'p2', spell);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('its owner applies it from their own hand - a bought-back spell stand-in - named with its colours to every seat', () => {
    assistedSpell();
    const g = startedGame({ decks: [[ASSISTED]] });
    holdEverywhere(g);
    main(g);
    const spell = put(g, 'p1', ASSISTED, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.cards[spell]?.zone.kind, 'resolved, with nothing applied yet').toBe('graveyard');
    // Where buyback puts it as it resolves (CR 702.27a) - by a Tier-3 move, as no buyback spell is assisted today.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spell, to: { kind: 'hand', player: 'p1' } }));
    const hand = idsIn(g, 'p1', 'hand').length;
    const from = mark(g);
    must(g.submit({ t: 'ManualApplyEffect', player: 'p1', card: spell, targets: [] }));
    expect(idsIn(g, 'p1', 'hand').length, 'the part the app understands: draw a card').toBe(hand + 1);
    expect(rows(g, from, 'p1')).toEqual([{ text: `You apply the part of ${ASSISTED} the app understands. The rest is yours.`, identity: ['U'] }]);
    for (const seat of OTHERS) {
      expect(rows(g, from, seat)).toEqual([{ text: `Ana applies the part of ${ASSISTED} the app understands. The rest is theirs.`, identity: ['U'] }]);
    }
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

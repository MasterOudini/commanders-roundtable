// src/engine/faceDownReveal.test.ts - COPY INTO src/engine/ (the imports are relative to that folder). D587, FIX-LIST 12.
//
// CR 708.9 - "If a face-down permanent ... moves from the battlefield to any other zone, its owner must reveal it to all
// players as they move it." The Tier-3 move (`ManualMoveCard`) named a face-down permanent the way the table sees it ON
// the battlefield - "a face-down creature", no colours - WHEREVER it went, so a morph tucked, bounced or put into a
// graveyard by hand was never revealed (and, gone into a library or a hand, never could be again), while the engine's own
// lines reveal it: the dies line (sba.ts) and the exiled-instead and unearth lines (triggers.ts `leavingName`) name it by
// its printed face. What is proven here, on EVERY seat's projected rows (the actor's own in the second person): a
// face-down creature moved from the battlefield to a library, a hand, a graveyard and exile is named by its printed FRONT
// face with its colours (one turned to its back face by hand included - off the battlefield a double-faced card has only
// its front face, CR 712.8a) and by no line before; a move INTO exile face down is revealed too (708.9 has no exception -
// it lands face down), while a face-down card moved OUT of exile names nothing; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { project } from './project';
import { findAnywhere, holdEverywhere, must, ORACLE, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const DELVER = 'Delver of Secrets // Insectile Aberration';
const FRONT = 'Delver of Secrets';
const BACK = 'Insectile Aberration';
const BEARS = 'Grizzly Bears';
const ANGEL = 'Serra Angel';
const OTHERS = ['p2', 'p3', 'p4'] as const;

const view = (g: Game, seat: PlayerId) => project(g.state, ORACLE, g.deps.scripts, seat);
/** The newest narration line's id: a test reads the lines after it. */
const mark = (g: Game) => g.state.narration[g.state.narration.length - 1]?.id ?? -1;
/** The lines after `from` as `seat` reads them: its projected rows (second person for its own lines) and colours. */
const rows = (g: Game, from: number, seat: PlayerId) => view(g, seat).log.filter((e) => e.id > from).map((e) => ({ text: e.text, identity: e.identity }));
/** A card onto its owner's battlefield face down, the way a morph arrives: never named, even as it lands. */
function faceDownOnto(g: Game, player: PlayerId, name: string): InstanceId {
  const card = findAnywhere(g, player, name);
  must(g.submit({ t: 'ManualMoveCard', player, card, to: { kind: 'battlefield', player }, faceDown: true }));
  expect(g.state.cards[card]?.faceDown).toBe(true);
  return card;
}
/** No seat reads any of `names` on a line after `from`, and no row carries a colour. */
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

describe('CR 708.9 - a face-down permanent leaving the battlefield is revealed as it moves', () => {
  test('tucked, bounced and put into a graveyard by hand: every seat reads its printed front face and its colours - and no line before', () => {
    const g = startedGame({ decks: [[], [DELVER, BEARS, ANGEL]] });
    holdEverywhere(g);
    const from = mark(g);
    const delver = faceDownOnto(g, 'p2', DELVER);
    const bears = faceDownOnto(g, 'p2', BEARS);
    const angel = faceDownOnto(g, 'p2', ANGEL);
    // Turned to its back face by hand while face down: what the move reveals is still the card's FRONT face (CR 712.8a).
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: delver }));
    expect(g.state.cards[delver]?.faceIndex).toBe(1);
    namesNothing(g, from, [FRONT, BACK, BEARS, ANGEL]);
    const revealed = mark(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: delver, to: { kind: 'library', player: 'p2' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p2' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'graveyard', player: 'p2' } }));
    expect([g.state.cards[delver]?.zone.kind, g.state.cards[bears]?.zone.kind, g.state.cards[angel]?.zone.kind]).toEqual(['library', 'hand', 'graveyard']);
    const moved = [`${FRONT} to their library.`, `${BEARS} to their hand.`, `${ANGEL} to the graveyard.`];
    const colours = [['U'], ['G'], ['W']];
    expect(rows(g, revealed, 'p1')).toEqual(moved.map((line, i) => ({ text: `You move ${line}`, identity: colours[i] })));
    for (const seat of OTHERS) expect(rows(g, revealed, seat)).toEqual(moved.map((line, i) => ({ text: `Ana moves ${line}`, identity: colours[i] })));
    expect(g.state.narration.map((l) => l.text).filter((t) => t.includes(BACK)), 'never by the back face it was turned to').toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('exiled face down it is still revealed as it moves (708.9 has no exception); a move out of face-down exile names nothing; exiled face up, it is revealed', () => {
    const g = startedGame({ decks: [[], [BEARS, ANGEL]] });
    holdEverywhere(g);
    const bears = faceDownOnto(g, 'p2', BEARS);
    const angel = faceDownOnto(g, 'p2', ANGEL);
    const from = mark(g);
    // Exiled face down (a hand-built move - the card menu never sends `faceDown`): revealed as it moves (CR 708.9), it lands face down.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'exile', player: 'p2' }, faceDown: true }));
    expect(g.state.cards[bears]?.faceDown).toBe(true);
    const out = mark(g);
    // Out of face-down exile into its owner's hand: CR 708.9 reveals nothing that leaves exile.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p2' } }));
    namesNothing(g, out, [BEARS, ANGEL]);
    const revealed = mark(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'exile', player: 'p2' } }));
    expect(g.state.cards[angel]?.faceDown, 'exiled face up').toBe(false);
    expect(rows(g, from, 'p3').map((r) => r.text)).toEqual([
      `Ana moves ${BEARS} to exile face down.`,
      'Ana moves a face-down card to their hand.',
      `Ana moves ${ANGEL} to exile.`,
    ]);
    expect(rows(g, revealed, 'p1')).toEqual([{ text: `You move ${ANGEL} to exile.`, identity: ['W'] }]);
    for (const seat of OTHERS) expect(rows(g, revealed, seat)).toEqual([{ text: `Ana moves ${ANGEL} to exile.`, identity: ['W'] }]);
    expect(rows(g, from, 'p3')[0]?.identity, 'the reveal carries its colours').toEqual(['G']);
    expect(g.state.narration.map((l) => l.text).filter((t) => t.includes(BEARS)), 'the Bears are named once - on the reveal').toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

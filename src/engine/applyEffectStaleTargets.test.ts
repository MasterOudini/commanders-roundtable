// src/engine/applyEffectStaleTargets.test.ts - COPY INTO src/engine/ (the imports are relative to that folder). D587,
// FIX-LIST 13.
//
// CR 608.2b / 400.7 - the assisted offer (`ManualApplyEffect`) carries the spell's targets AS IT RESOLVED (StackResolved,
// the view event, PromptBar's offer), and it is a notification, not a question: play goes on while it waits. The tool
// checked the card it applies (the hidden-zone guard) but handed the targets to the executor unfiltered, and the
// executor's aim admits a card in any zone - so a creature bounced to its owner's hand before Apply was "destroyed" from
// the battlefield it had already left, into its hand AND its graveyard (an InvariantError inside Game.submit in a test; a
// silently corrupt state in a live game, whose host runs without the checks), and one that had died since died again.
// What is proven here, with Cinder Cloud - an assisted instant: "Destroy target creature." is read, the white creature's
// burn is not: the offer's creature bounced to a hand - the apply refused, no event, the card in the hand alone; the
// offer's creature died since (a graveyard is no battlefield) - refused the same way, no second move off the battlefield;
// a stale pick is dropped IN PLACE - the clause it answered finds no target and the pick after it never slides onto that
// clause - while a live creature where the clause reads is still destroyed; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, idsIn, must, ORACLE, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { TargetChoice } from './types/state';

/** A {3}{R}{R} instant: "Destroy target creature." is the part the app understands; the white creature's burn is not. */
const SPELL = 'Cinder Cloud';
const BEARS = 'Grizzly Bears';
const ANGEL = 'Serra Angel';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game) =>
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
/** The newest narration line's id: a test reads the lines after it. */
const mark = (g: Game) => g.state.narration[g.state.narration.length - 1]?.id ?? -1;
/** The canonical lines after `from` - the NDJSON log's own third-person text. */
const said = (g: Game, from: number) => g.state.narration.filter((l) => l.id > from).map((l) => l.text);

/** The file's premise: the parser reads this card IN PART - one destroy, aimed at its one clause, a creature. Its text. */
function assistedDestroy(): string {
  const face = ORACLE.byName(SPELL)?.faces[0];
  expect(face?.effectMode, `${SPELL} is an assisted spell`).toBe('assisted');
  expect(face?.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['destroy', 0]]);
  expect(face?.targets).toHaveLength(1);
  expect(face?.targets[0]?.kinds).toContain('creature');
  return face?.effects[0]?.text ?? '';
}

/**
 * Ana's Cinder Cloud cast at Ben's Bears and resolved: the Bears stand - an assisted spell does nothing by itself (D90) -
 * and the offer is its StackResolved's targets, the spell's as it resolved (what PromptBar sends back on Apply).
 */
function offered(): { g: Game; spell: InstanceId; bears: InstanceId; targets: readonly TargetChoice[] } {
  const g = startedGame({ players: 2, decks: [[SPELL], [BEARS, ANGEL]] });
  holdEverywhere(g);
  main(g);
  const spell = put(g, 'p1', SPELL, 'hand');
  const bears = put(g, 'p2', BEARS);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  expect([g.state.cards[spell]?.zone.kind, g.state.cards[bears]?.zone.kind], 'resolved, and nothing applied yet').toEqual(['graveyard', 'battlefield']);
  const offers = g.log.flatMap((e) => (e.body.t === 'StackResolved' && e.body.card === spell ? [e.body.targets] : []));
  expect(offers, "the offer: the spell's targets as it resolved").toEqual([[{ kind: 'card', id: bears }]]);
  return { g, spell, bears, targets: offers[0] ?? [] };
}

/** A refused apply: `illegalTarget`, and no event and no state change. */
function refused(g: Game, card: InstanceId, targets: readonly TargetChoice[]): void {
  const events = g.log.length;
  const hash = g.hash();
  const result = g.submit({ t: 'ManualApplyEffect', player: 'p1', card, targets });
  expect(result.ok, 'every target the offer named is gone').toBe(false);
  if (!result.ok) expect(result.reason).toBe('illegalTarget');
  expect(g.log.length, 'no event').toBe(events);
  expect(g.hash(), 'no state change').toBe(hash);
}

describe('CR 608.2b - the assisted apply never aims at a target that has gone', () => {
  test("the offer's creature bounced to its owner's hand before Apply: refused - no event, the card in the hand alone", () => {
    assistedDestroy();
    const { g, spell, bears, targets } = offered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    refused(g, spell, targets);
    expect([g.state.cards[bears]?.zone.kind, idsIn(g, 'p2', 'hand').includes(bears), idsIn(g, 'p2', 'graveyard').includes(bears)], 'in the hand, and only there').toEqual(['hand', true, false]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("the offer's creature died since - a graveyard is no battlefield: refused the same way, and it never leaves the battlefield twice", () => {
    assistedDestroy();
    const { g, spell, bears, targets } = offered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    const leaves = () => g.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === bears && m.from.kind === 'battlefield')).length;
    const left = leaves();
    refused(g, spell, targets);
    expect(leaves(), 'no second move off the battlefield it left').toBe(left);
    expect(idsIn(g, 'p2', 'graveyard').filter((id) => id === bears)).toEqual([bears]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a stale pick is dropped IN PLACE: its clause finds no target and the pick after it never takes its place - a live creature where the clause reads is destroyed', () => {
    const clause = assistedDestroy();
    const { g, spell, bears, targets } = offered();
    const angel = put(g, 'p2', ANGEL);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    // A hand-built intent (the tool is permissive, D120): the gone Bears where the clause reads, a live Angel after them.
    // Compacting the list would slide the Angel onto the destroy clause it never answered.
    const from = mark(g);
    must(g.submit({ t: 'ManualApplyEffect', player: 'p1', card: spell, targets: [...targets, { kind: 'card', id: angel }] }));
    expect([g.state.cards[bears]?.zone.kind, g.state.cards[angel]?.zone.kind], 'nothing destroyed').toEqual(['hand', 'battlefield']);
    expect(said(g, from)).toEqual([`${SPELL} — no legal target left for “${clause}”`, `Ana applies the part of ${SPELL} the app understands. The rest is theirs.`]);
    // The Angel where the clause reads: a legal pick still reaches the executor.
    must(g.submit({ t: 'ManualApplyEffect', player: 'p1', card: spell, targets: [{ kind: 'card', id: angel }] }));
    expect(g.state.cards[angel]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

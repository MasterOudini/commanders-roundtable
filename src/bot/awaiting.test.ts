// ⚠️ THIS IS THE D102 TEST. A driver with no case for a prompt returns null and
// the game stops forever with no error — that is how `two-instance.cjs` read
// 21/24 for weeks. So: one hand-built prompt per `Awaiting` kind, and an
// assertion that the bot answers, waits or faults DELIBERATELY, never silently.
//
// The compile-time half of the guard lives in `awaiting.ts` (a `never` check, so
// a thirteenth kind fails `tsc -b`); this is the runtime half, and it also pins
// WHAT each answer is, because "returns something" is not the same as "returns
// something the handler accepts".
//
// ⚠️ EVERY KIND NOW ACTS — there is no deliberate fault left. The two that used
// to fault are gone or fixed (D125): `assignCombatDamage` had no answering
// intent and was deleted from the union, and `orderAttackers` became answerable
// when `CardView.blocking` became an array. The producer side is asserted
// separately in `src/engine/awaitingProducers.node.test.ts` — this file proves
// the prompts can be ANSWERED, that one proves which can be RAISED.

import { describe, expect, test } from 'vitest';
import type { Awaiting } from '../engine/types/state';
import type { PlayerView } from '../view/types';
import { GRIZZLY_BEARS, SERRA_ANGEL, FOREST, LIGHTNING_BOLT } from '../data/fixtures/engineCards';
import { answerAwaiting } from './awaiting';
import type { BotPort, BotSnapshot } from './types';

const ME = 'p1';
const FOE = 'p2';

function card(id: string, data: typeof GRIZZLY_BEARS, over: Partial<PlayerView['cards'][string]> = {}) {
  return {
    instanceId: id,
    card: data,
    faceIndex: 0,
    faceDown: false,
    controller: ME,
    owner: ME,
    tapped: false,
    summoningSick: false,
    damage: 0,
    counters: {},
    power: data.faces[0]?.power === null ? null : Number(data.faces[0]?.power ?? 0),
    toughness: data.faces[0]?.toughness === null ? null : Number(data.faces[0]?.toughness ?? 0),
    attachedTo: null,
    isCommander: false,
    isToken: false,
    attacking: null,
    blocking: [],
    ...over,
  };
}

function makeView(): PlayerView {
  return {
    me: ME,
    seatOrder: [ME, FOE],
    seats: {
      [ME]: seat(ME),
      [FOE]: seat(FOE),
    },
    cards: {
      h1: card('h1', FOREST),
      h2: card('h2', GRIZZLY_BEARS),
      h3: card('h3', SERRA_ANGEL),
      h4: card('h4', LIGHTNING_BOLT),
      // ⚠️ b1 blocks BOTH attackers, which is the whole reason `blocking` is an
      // array. With a single-block board the `orderAttackers` answer is
      // indistinguishable from the one-id field it replaced, and the case it
      // exists for would go untested. e2 is the SMALLER creature, listed second,
      // so "weakest first" is a visible re-sort rather than the identity.
      b1: card('b1', GRIZZLY_BEARS, { blocking: ['e1', 'e2'] }),
      b2: card('b2', SERRA_ANGEL),
      e1: card('e1', SERRA_ANGEL, { controller: FOE, owner: FOE, attacking: ME }),
      e2: card('e2', GRIZZLY_BEARS, { controller: FOE, owner: FOE, attacking: ME }),
    },
    zones: {
      [`hand:${ME}`]: ['h1', 'h2', 'h3', 'h4'],
      [`bf:${ME}`]: ['b1', 'b2'],
      [`bf:${FOE}`]: ['e1', 'e2'],
    },
    stack: [],
    turn: { active: ME, phase: 'main1', turnNumber: 3 },
    priority: ME,
    log: [],
    hiddenCounts: {},
    peek: [],
  } as unknown as PlayerView;
}

function seat(id: string) {
  return {
    playerId: id,
    name: id,
    life: 40,
    cmdDamage: {},
    poison: 0,
    manaPool: {},
    lost: false,
  };
}

function makePort(view: PlayerView): BotPort {
  return {
    snapshot: (): BotSnapshot => ({
      you: ME,
      running: true,
      finished: false,
      awaiting: null,
      priority: ME,
      legal: [],
      turn: { number: 3, active: ME, step: 'main1' },
      eventCount: 1,
      rejectSeq: 0,
      message: null,
    }) as unknown as BotSnapshot,
    currentView: () => view,
    submit: () => undefined,
    previewCast: () => null,
    legalTargetsFor: () => [{ kind: 'card', id: 'e1' }],
    targetSpecsFor: () => [],
  };
}

/** One prompt per kind, all thirteen, in the order `state.ts` declares them. */
const PROMPTS: readonly [Awaiting['kind'], Awaiting][] = [
  ['mulligan', { kind: 'mulligan', players: [FOE, ME], submitted: [] }],
  ['mulliganBottom', { kind: 'mulliganBottom', player: ME, count: 2 }],
  ['declareAttackers', { kind: 'declareAttackers', player: ME, attackers: ['b1', 'b2'], defenders: [{ kind: 'player', id: FOE }] }],
  ['declareBlockers', { kind: 'declareBlockers', players: [ME], submitted: [], legal: [{ blocker: 'b1', attackers: ['e1'] }] }],
  ['orderBlockers', { kind: 'orderBlockers', player: ME, attacker: 'e1' }],
  ['orderAttackers', { kind: 'orderAttackers', player: ME, blocker: 'b1' }],
  ['orderTriggers', { kind: 'orderTriggers', player: ME, triggers: ['t1', 't2'] }],
  ['chooseLegendKeep', { kind: 'chooseLegendKeep', player: ME, name: 'Jasmine Boreal', candidates: ['b1', 'b2'] }],
  ['commanderZoneChoice', { kind: 'commanderZoneChoice', player: ME, queue: [{ player: ME, card: 'b1', from: { kind: 'graveyard', player: ME } }] }],
  ['chooseX', { kind: 'chooseX', player: ME, stackId: 's1', source: 'h4', label: 'X' }],
  ['chooseTargets', { kind: 'chooseTargets', player: ME, stackId: 's1', count: 1, source: 'h4', label: 'Bolt', specs: [{ kinds: ['creature'], min: 1, max: 1, controller: 'any', zones: ['battlefield'], text: 'target creature', confident: true, unenforced: [] }], forKind: 'spell' }],
  ['optionalTrigger', { kind: 'optionalTrigger', player: ME, stackId: 's1', source: 'b1', label: "Ajani's Mantra — gain 1 life" }],
  ['rewindVote', { kind: 'rewindVote', proposer: FOE, toEventCount: 10, agreed: [FOE], declined: [] }],
] as unknown as readonly [Awaiting['kind'], Awaiting][];

/**
 * By KIND, never by index.
 *
 * ⚠️ These lookups were `PROMPTS[9]`, `PROMPTS[11]` — and deleting one variant
 * from the union silently re-pointed every one of them at its neighbour. An
 * index into a list whose length is the thing under test is a check that lies
 * the first time the list changes.
 */
function promptFor(kind: Awaiting['kind']): Awaiting {
  const found = PROMPTS.find(([k]) => k === kind);
  if (!found) throw new Error(`no fixture prompt for ${kind}`);
  return found[1];
}

describe('an answer for every prompt', () => {
  test('all thirteen kinds are covered by this test', () => {
    // ⚠️ The canary on the TEST, not on the code: a fourteenth kind must not be
    // able to slip past by simply not appearing here.
    expect(new Set(PROMPTS.map(([k]) => k)).size).toBe(13);
  });

  test.each(PROMPTS)('%s is never answered with silence', (_kind, awaiting) => {
    const port = makePort(makeView());
    const decision = answerAwaiting(port, awaiting, ME, 0);
    expect(['act', 'wait', 'fault']).toContain(decision.t);
    expect(decision.why).not.toBe('');
  });

  /**
   * ⚠️ ALL THIRTEEN ACT, and that is the change D125 made and D128 kept. This
   * asserted eleven of thirteen for as long as the union carried a prompt with
   * no answering intent (`assignCombatDamage`, now deleted) and one whose answer
   * a `PlayerView` could not express (`orderAttackers`, answerable since
   * `blocking` became an array). A fault surviving here again means a prompt has
   * gone unanswerable.
   */
  test('every one of the thirteen produces a real intent', () => {
    const port = makePort(makeView());
    const acted = PROMPTS.filter(([, a]) => answerAwaiting(port, a, ME, 0).t === 'act');
    expect(acted.map(([k]) => k)).toEqual(PROMPTS.map(([k]) => k));
  });

  /**
   * ⚠️ THE CASE THE ARRAY EXISTS FOR. b1 blocks e1 AND e2; the handler checks
   * `sameSet(decl.attackerOrder, intent.order)`, so an answer naming one of them
   * is rejected — which is exactly what the old single-id `blocking` could
   * produce. Weakest first, so a 2/2 Bears is placed before a 4/4 Angel.
   */
  test('orderAttackers lists every attacker the blocker is blocking, weakest first', () => {
    const port = makePort(makeView());
    const d = answerAwaiting(port, promptFor('orderAttackers'), ME, 0);
    expect(d.t).toBe('act');
    expect(d.t === 'act' && d.intent.t).toBe('OrderAttackers');
    expect(d.t === 'act' && d.intent.t === 'OrderAttackers' && d.intent.order).toEqual(['e2', 'e1']);
  });

  test('orderBlockers finds a blocker through the array, not by equality', () => {
    const port = makePort(makeView());
    const d = answerAwaiting(port, promptFor('orderBlockers'), ME, 0);
    expect(d.t === 'act' && d.intent.t === 'OrderBlockers' && d.intent.order).toEqual(['b1']);
  });

  /**
   * ⚠️ A prompt the view disagrees with FAULTS rather than guessing. The handler
   * rejects a short order, so answering with what little the view can see would
   * be a rejection loop — the livelock half of D102 — and a bot that guessed
   * would be putting combat damage on the wrong creature.
   */
  test('orderAttackers faults when the view cannot place every attacker', () => {
    const view = makeView();
    view.cards['b1'] = card('b1', GRIZZLY_BEARS, { blocking: ['e1', 'ghost'] });
    const d = answerAwaiting(makePort(view), promptFor('orderAttackers'), ME, 0);
    expect(d.t).toBe('fault');
    expect(d.t === 'fault' && d.kind).toBe('viewCannotExpressMultiBlock');
  });

  /**
   * ⚠️ THE BUG `simplestIntent` HAS. It reads `awaiting.players[0]` and compares
   * it to its own seat, so a player sitting anywhere but first is never
   * answered — and the mulligan prompt lists every player. A bot seat is exactly
   * the seat most likely to be second.
   */
  test('a seat that is not first in the mulligan list still answers', () => {
    const port = makePort(makeView());
    const d = answerAwaiting(port, { kind: 'mulligan', players: [FOE, ME], submitted: [] }, ME, 0);
    expect(d.t).toBe('act');
    expect(d.t === 'act' && d.intent.t).toBe('MulliganDecision');
  });

  test('a hand with two lands is kept, one with none is not', () => {
    const view = makeView();
    const keep = answerAwaiting(makePort(view), promptFor('mulligan'), ME, 0);
    expect(keep.t === 'act' && keep.intent.t === 'MulliganDecision' && keep.intent.keep).toBe(false);

    const landy = makeView();
    landy.cards['h2'] = card('h2', FOREST);
    landy.cards['h3'] = card('h3', FOREST);
    const kept = answerAwaiting(makePort(landy), promptFor('mulligan'), ME, 0);
    expect(kept.t === 'act' && kept.intent.t === 'MulliganDecision' && kept.intent.keep).toBe(true);
  });

  /**
   * ⚠️ THE SECOND ATTEMPT MUST BE THE MINIMAL LEGAL ANSWER, not the same one.
   * Menace is checked across the whole block declaration and is not in the
   * pairing list, so a bot CAN have a good-looking block rejected — and
   * answering identically is the livelock.
   */
  test('a rejected combat answer falls back to declaring nothing', () => {
    const port = makePort(makeView());
    const blocks = answerAwaiting(port, promptFor('declareBlockers'), ME, 1);
    expect(blocks.t === 'act' && blocks.intent.t === 'DeclareBlockers' && blocks.intent.blocks).toEqual([]);
    const attacks = answerAwaiting(port, promptFor('declareAttackers'), ME, 1);
    expect(attacks.t === 'act' && attacks.intent.t === 'DeclareAttackers' && attacks.intent.attackers).toEqual([]);
  });

  /**
   * ⚠️ Half of D102's termination rule: an unsatisfiable clause is ABANDONED
   * rather than left unanswered. The other half is in `policy.ts`, which refuses
   * to cast the spell in the first place.
   */
  test('targets that cannot be planned cancel the cast rather than wedging', () => {
    const port = { ...makePort(makeView()), legalTargetsFor: () => [] };
    const d = answerAwaiting(port, promptFor('chooseTargets'), ME, 0);
    expect(d.t === 'act' && d.intent.t).toBe('CancelPendingCast');
  });

  test('a prompt for somebody else is a wait, not a fault', () => {
    const port = makePort(makeView());
    const d = answerAwaiting(port, { kind: 'chooseX', player: FOE, stackId: 's1', source: 'h4', label: 'X' }, ME, 0);
    expect(d.t).toBe('wait');
  });
});

// The DRIVER's answer to every prompt — the third answerer, and the one that had
// gone unchecked.
//
// ⚠️ D102 ONE MORE TIME. `simplestAnswer` returned a bare `null` for
// `mulliganBottom` and `rewindVote`: `answer()` throws on it and the fuzzer's
// `default:` branch submits nothing ever again, with a wedged game looking
// exactly like a healthy idle one. Both kinds HAVE producers — `loop.ts` raises
// the first whenever a kept hand owes cards, `handlers.ts` the second on any
// `ProposeRewind` — so these were live wedges rather than theoretical ones, and
// what hid them is instructive: the 500-seed gate never hit either, because the
// fuzzer carries its OWN randomised `mulliganBottom` case and never proposes a
// rewind at all. A driver's fallback that nothing exercises is a driver's
// fallback that rots. See D125.
//
// ⚠️ EVERY PROMPT HERE IS REACHED FOR REAL, not hand-built. D102's other half is
// that going green is not the same as being exercised: the two-instance sign-off
// passed 25/25 while its log held two land drops and nothing else. A test that
// constructs an `Awaiting` literal and feeds it to `simplestAnswer` proves the
// switch has a case; only submitting the result to the real handler proves the
// answer is one the game accepts.

import { describe, expect, test } from 'vitest';
import {
  answer,
  advanceUntil,
  holdEverywhere,
  idsIn,
  must,
  newTestGame,
  put,
  simplestAnswer,
  startedGame,
} from './testing/harness';

describe('simplestAnswer — the driver answers every prompt it is given', () => {
  /**
   * ⚠️ REACHED BY REALLY MULLIGANING. `startedGame` cannot be used — it keeps
   * every hand, which is precisely how this prompt stayed unexercised.
   *
   * ⚠️ TWO mulligans for ONE card, not one for one: the free first mulligan is on
   * by default (D44 Q2), so a single mulligan redraws seven and owes NOTHING —
   * the prompt is never raised and the game walks straight past it. Worth
   * knowing before writing any test that means to reach this.
   */
  test('mulliganBottom is answered, and the cards really go to the bottom', () => {
    const game = newTestGame();
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    for (const p of ['p2', 'p3', 'p4']) {
      must(game.submit({ t: 'MulliganDecision', player: p, keep: true }));
    }
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));

    const awaiting = game.state.priority.awaiting;
    expect(awaiting?.kind).toBe('mulliganBottom');
    if (awaiting?.kind !== 'mulliganBottom') throw new Error('unreachable');
    expect(awaiting.count).toBe(1);

    const handBefore = idsIn(game, 'p1', 'hand');
    expect(handBefore.length).toBe(7);

    // The whole point: this used to throw `no simple answer for prompt
    // "mulliganBottom"`.
    answer(game, awaiting);

    // ⚠️ ASSERTED ON THE MOVE, NOT ON ZONE SIZES. Answering the last mulligan
    // lets `pump()` run the game on — turn 1 begins and, on an empty board with
    // nobody able to act, several turns can go by inside this one submit. p1
    // draws in there, so "hand is one smaller" is 7 again and reads as the
    // bottoming having silently failed. The EVENT is what happened; the zone
    // count is what happened plus everything after it.
    const bottomed = game.log.filter((e) => e.body.t === 'MulliganBottomed');
    expect(bottomed.length).toBe(1);
    const body = bottomed[0]?.body;
    if (body?.t !== 'MulliganBottomed') throw new Error('unreachable');
    expect(body.player).toBe('p1');
    expect(body.cards.length).toBe(awaiting.count);
    for (const card of body.cards) {
      expect(handBefore).toContain(card);
      expect(idsIn(game, 'p1', 'library')).toContain(card);
    }

    // The prompt is GONE, which is what "terminating" means — an answer the
    // handler accepts but that re-arms the same prompt is the livelock.
    expect(game.state.priority.awaiting?.kind).not.toBe('mulliganBottom');
  });

  /** The cards named are the ones that moved, and no card is named twice. */
  test('the bottomed cards come from the hand, and are distinct', () => {
    const game = newTestGame();
    for (let i = 0; i < 3; i++) {
      must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    }
    for (const p of ['p2', 'p3', 'p4']) {
      must(game.submit({ t: 'MulliganDecision', player: p, keep: true }));
    }
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: true }));

    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'mulliganBottom') throw new Error('expected mulliganBottom');
    // Three mulligans, one of them free — so two cards owed.
    expect(awaiting.count).toBe(2);

    const hand = idsIn(game, 'p1', 'hand');
    const intent = simplestAnswer(awaiting, game.state);
    if (intent?.t !== 'MulliganBottom') throw new Error('expected a MulliganBottom intent');
    expect(intent.cards.length).toBe(2);
    expect(new Set(intent.cards).size).toBe(2);
    for (const card of intent.cards) expect(hand).toContain(card);

    answer(game, awaiting);
    const library = idsIn(game, 'p1', 'library');
    for (const card of intent.cards) {
      expect(idsIn(game, 'p1', 'hand')).not.toContain(card);
      expect(library).toContain(card);
    }
  });

  /**
   * ⚠️ REACHED BY REALLY PROPOSING, and answered with a DECLINE — which is what
   * this function's header promises and, more to the point, the answer that
   * terminates: `voteRewind` short-circuits on the first decline, so one submit
   * ends it at any table size.
   */
  test('rewindVote is answered, and one decline ends the vote', () => {
    const game = startedGame();
    const at = game.state.eventCount;
    must(game.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: at }));

    const awaiting = game.state.priority.awaiting;
    expect(awaiting?.kind).toBe('rewindVote');
    if (awaiting?.kind !== 'rewindVote') throw new Error('unreachable');
    // The proposer is auto-agreed at proposal, so the driver must not try to
    // vote as them — `voteRewind` rejects a second vote from one seat.
    expect(awaiting.agreed).toEqual(['p1']);

    answer(game, awaiting);

    expect(game.state.priority.awaiting).toBeNull();
    // ⚠️ The log is what proves it CANCELLED rather than passed. A unanimous
    // agreement also clears the awaiting, and the difference between the two is
    // invisible in the state alone.
    expect(game.log.some((e) => e.body.t === 'RewindCancelled')).toBe(true);
    expect(game.state.eventCount).toBeGreaterThan(at);
  });

  /** A seat that has already voted is never asked again — that is a rejection. */
  test('the rewind voter is a living seat that has not voted', () => {
    const game = startedGame();
    must(game.submit({ t: 'ProposeRewind', player: 'p2', toEventCount: game.state.eventCount }));
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'rewindVote') throw new Error('expected rewindVote');

    const intent = simplestAnswer(awaiting, game.state);
    if (intent?.t !== 'VoteRewind') throw new Error('expected a VoteRewind intent');
    expect(intent.agree).toBe(false);
    expect(intent.player).not.toBe('p2');
    expect(game.state.players[intent.player]?.hasLost).toBe(false);
  });

  /**
   * ⚠️ NO PRODUCER, ANSWERED ANYWAY — and submitted, because the handler is the
   * only thing that can say the answer is legal. `sameSet` wants exactly the
   * creatures already in the declaration, so the state's own order is the one
   * answer always accepted; both handlers take the intent with no `Awaiting`
   * gate, which is what lets this be checked at all today.
   */
  test('the combat-order prompts answer with the order the state already holds', () => {
    const game = startedGame({
      players: 2,
      decks: [['Grizzly Bears', 'Scathe Zombies'], ['Serra Angel']],
    });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const zombie = put(game, 'p1', 'Scathe Zombies');
    const angel = put(game, 'p2', 'Serra Angel');
    holdEverywhere(game);
    advanceUntil(
      game,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    );
    must(
      game.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: bear, defender: { kind: 'player', id: 'p2' } },
          { card: zombie, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    advanceUntil(game, (s) => s.priority.awaiting?.kind === 'declareBlockers');
    must(
      game.submit({
        t: 'DeclareBlockers',
        player: 'p2',
        blocks: [
          { blocker: angel, attacker: bear },
          { blocker: angel, attacker: zombie },
        ],
      }),
    );

    const attackerOrder = simplestAnswer(
      { kind: 'orderAttackers', player: 'p2', blocker: angel },
      game.state,
    );
    if (attackerOrder?.t !== 'OrderAttackers') throw new Error('expected an OrderAttackers intent');
    expect(attackerOrder.order).toEqual([bear, zombie]);
    must(game.submit(attackerOrder));

    const blockerOrder = simplestAnswer(
      { kind: 'orderBlockers', player: 'p1', attacker: bear },
      game.state,
    );
    if (blockerOrder?.t !== 'OrderBlockers') throw new Error('expected an OrderBlockers intent');
    expect(blockerOrder.order).toEqual([angel]);
    must(game.submit(blockerOrder));
  });

  /**
   * ⚠️ THE THREE PROMPTS THEIR OWN PRODUCERS MAKE IMPOSSIBLE — an empty mulligan
   * list, a block declaration everyone has already submitted, a legend choice
   * with no candidates. Each was an `x ? … : null` ternary, which is the same
   * wedge as a bare `null` in the one case it fires.
   *
   * They are hand-built here BECAUSE they are unreachable: `advanceMulligan`
   * returns early once nobody is pending, the blockers handler clears the prompt
   * on the last submit, and `findLegendChoice` skips any group under two copies.
   * The assertion is not that these happen — it is that the driver has an answer
   * if one ever does, rather than going silent at the worst possible moment.
   */
  test('a malformed prompt is still answered, never met with silence', () => {
    const game = startedGame();
    const malformed = [
      { kind: 'mulligan', players: [], submitted: ['p1', 'p2', 'p3', 'p4'] },
      { kind: 'declareBlockers', players: ['p2'], submitted: ['p2'], legal: [] },
      { kind: 'chooseLegendKeep', player: 'p1', name: 'Krenko, Mob Boss', candidates: [] },
    ] as const;

    for (const awaiting of malformed) {
      const intent = simplestAnswer(awaiting, game.state);
      expect(intent, `${awaiting.kind}`).not.toBeNull();
      // A real seat, or the named non-id — never `undefined` leaking into an
      // intent, which is what an unchecked `players[0]` would have produced.
      expect('player' in intent, `${awaiting.kind}`).toBe(true);
      if (!('player' in intent)) throw new Error('unreachable');
      expect(typeof intent.player, `${awaiting.kind}`).toBe('string');
      expect(intent.player.length, `${awaiting.kind}`).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ AND THE ANSWER IS REJECTED, WHICH IS THE WHOLE ARGUMENT FOR IT. `answer()`
   * turns a rejection into the HANDLER's message — "You have already voted", "not
   * one of the copies you control" — where a null said `no simple answer for
   * prompt "…"` and pointed at the driver rather than at the malformed prompt.
   */
  test('and the rejection names the disagreement, not the driver', () => {
    const game = startedGame();
    expect(() =>
      answer(game, { kind: 'chooseLegendKeep', player: 'p1', name: 'Krenko, Mob Boss', candidates: [] }),
    ).toThrow(/answering chooseLegendKeep: .+/);
    expect(() =>
      answer(game, { kind: 'chooseLegendKeep', player: 'p1', name: 'Krenko, Mob Boss', candidates: [] }),
    ).not.toThrow(/no simple answer/);
  });

  /**
   * ⚠️ THE CANARY ON THIS FILE. Not one kind may answer with `null` on a live
   * board — that is the whole defect, and a case added later that shrugs would
   * otherwise be caught by nothing. Driven with every prompt the engine can
   * currently be holding plus the two dormant combat-order ones.
   */
  test('no prompt reachable on a real board answers with silence', () => {
    const game = startedGame();
    must(game.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: game.state.eventCount }));
    const rewind = game.state.priority.awaiting;
    if (!rewind) throw new Error('expected a prompt');

    for (const awaiting of [
      rewind,
      { kind: 'declareAttackers', player: 'p1', attackers: [], defenders: [] },
      { kind: 'declareBlockers', players: ['p2'], submitted: [], legal: [] },
      { kind: 'orderBlockers', player: 'p1', attacker: 'nope' },
      { kind: 'orderAttackers', player: 'p1', blocker: 'nope' },
      { kind: 'orderTriggers', player: 'p1', triggers: [] },
      { kind: 'commanderZoneChoice', player: 'p1', queue: [] },
      { kind: 'chooseX', player: 'p1', stackId: 's1', source: 'x', label: 'X' },
      { kind: 'optionalTrigger', player: 'p1', stackId: 's1', source: 'x', label: 'a may trigger' },
    ] as const) {
      expect(simplestAnswer(awaiting, game.state), `${awaiting.kind}`).not.toBeNull();
    }
  });
});

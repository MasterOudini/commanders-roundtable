// CR 614.1c — a permanent whose text says it enters tapped, does. See D134.
//
// ⚠️ THE FIFTH BUCKET SPLIT DECIDED THIS SHAPE. `replacement` is 418 cards by
// sole need, and D134 measured what they actually are: 173 "enters tapped", 108
// "if … would … instead", 133 other "instead", 4 "as … enters". Only the first
// is a SELF-replacement with no choice, no ordering and no interaction — a
// property of the card, readable from its text — so it is a built-in rule beside
// D107's entry counters rather than the general CR 614 machinery.
//
// ⚠️ AND THE PAIR IS THE TEST. `Orzhov Guildgate` and `Haunted Ridge` are the
// same land one word apart; the anchor that separates them is the whole safety
// property.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { handle } from './handlers';
import { replay, stateHash } from './log';
import { applyReplacements } from './triggers';
import { NO_SCRIPTS } from './scripts/registry';
import type { GameState } from './types/state';
import { findAnywhere, must, ORACLE, put, startedGame } from './testing/harness';

const DECK = ['Orzhov Guildgate', 'Haunted Ridge', 'Forest', 'Plains'];

function tappedOnEntry(game: Game, name: string): boolean {
  const id = put(game, 'p1', name);
  return game.state.cards[id]?.tapped === true;
}

describe('enters tapped (CR 614.1c)', () => {
  test('the unconditional clause is read, and the card is now run in FULL', () => {
    const face = ORACLE.byName('Orzhov Guildgate')?.faces[0];
    expect(face?.oracleText).toBe('This land enters tapped.\n{T}: Add {W} or {B}.');
    expect(face?.entersTapped).toEqual({ unless: null });
  });

  /**
   * ⚠️ D134 REFUSED THIS AND D135 READS IT. `Haunted Ridge` is the same land one
   * word longer, and for one milestone it was the card that proved the anchor:
   * tapping it and dropping the condition would have been worse than doing
   * nothing. It is a CONDITION now rather than a refusal — the clause is read
   * and the query evaluated — which is the difference between refusing to guess
   * and knowing the answer.
   */
  test('“unless” is a CONDITION, not a refusal', () => {
    const face = ORACLE.byName('Haunted Ridge')?.faces[0];
    expect(face?.oracleText).toBe(
      'This land enters tapped unless you control two or more other lands.\n{T}: Add {B} or {R}.',
    );
    expect(face?.entersTapped).toEqual({
      unless: { kind: 'otherLands', at: 'least', count: 2 },
    });
  });

  test('a Guildgate arrives tapped, and so does an unmet condition', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    expect(tappedOnEntry(game, 'Orzhov Guildgate')).toBe(true);
    // No other lands out, so Haunted Ridge's condition fails and it too is tapped.
    expect(tappedOnEntry(game, 'Haunted Ridge')).toBe(true);
  });

  /**
   * ⚠️ A LAND DROP, not a Tier-3 tool. `put()` moves a card with
   * `ManualMoveCard`, which is a different code path from the one a player
   * takes — and the whole reason this rule lives in `applyReplacements` is that
   * TEN places move a card onto the battlefield and the tap must happen at all
   * of them.
   */
  test('and it is tapped when PLAYED, not only when moved', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    const gate = put(game, 'p1', 'Orzhov Guildgate', 'hand');
    must(game.submit({ t: 'PlayLand', player: 'p1', card: gate }));
    expect(game.state.cards[gate]?.tapped).toBe(true);
    // …and it is on the battlefield, not merely marked.
    expect(game.state.zones.battlefield).toContain(gate);
  });

  /**
   * ⚠️ A FACE-DOWN PERMANENT IS A 2/2 WITH NO ABILITIES (CR 708.2), so it has
   * no "enters tapped" however its face reads underneath — the same guard the
   * entry counters use, and the same reason.
   */
  test('a face-down entry is not tapped', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    // `findAnywhere`, because the opening seven takes 7 of ~30 and a named card
    // lands in hand often enough to be the harness's most common false failure.
    const gate = findAnywhere(game, 'p1', 'Orzhov Guildgate');
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: gate,
        to: { kind: 'battlefield', player: 'p1' },
        faceDown: true,
      }),
    );
    expect(game.state.cards[gate]?.tapped).toBe(false);
  });

  /**
   * ⚠️ `tapped` is part of `GameState` and so of the state hash, which is why
   * this is an EVENT and not a reducer branch: `apply` is pure in
   * (state, event) alone and cannot look a printing up, so a tap applied inside
   * the `CardsMoved` case would be a change replay could not reproduce.
   */
  test('the tap is on the LOG, and the game replays', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    const gate = put(game, 'p1', 'Orzhov Guildgate');
    const tap = game.log.find(
      (e) => e.body.t === 'PermanentsTapped' && e.body.cards.includes(gate),
    );
    expect(tap).toBeDefined();
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });

  test('a land that says nothing about tapping still arrives untapped', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    expect(tappedOnEntry(game, 'Forest')).toBe(false);
  });
});

/**
 * The CONDITION (D135). 112 more cards say "enters tapped UNLESS …", and the
 * seven board queries below came from the wordings the database actually
 * prints — 40 distinct, of which these cover 104.
 *
 * ⚠️ THE ENTERING LAND IS NOT ON THE BATTLEFIELD YET when the condition is
 * asked, which is exactly what "two or more OTHER lands" means.
 * `applyReplacements` runs on the state before its own event, so nothing has to
 * exclude the card itself — and a version that did would be wrong by one on
 * every dual land in the format.
 */
describe('enters tapped UNLESS (CR 614.1c with a condition)', () => {
  const LANDS = ['Sunpetal Grove', 'Neglected Manor', 'Lair of the Hydra', 'Godless Shrine', 'Haunted Ridge'];

  function game(): Game {
    return startedGame({ players: 2, decks: [LANDS, LANDS] });
  }

  test('a check-land is untapped only when you control the type it names', () => {
    const bare = game();
    expect(tappedOnEntry(bare, 'Sunpetal Grove')).toBe(true);

    const withForest = game();
    put(withForest, 'p1', 'Forest');
    expect(tappedOnEntry(withForest, 'Sunpetal Grove')).toBe(false);
  });

  test('…and an opponent’s Forest does not count', () => {
    const g = game();
    put(g, 'p2', 'Forest');
    expect(tappedOnEntry(g, 'Sunpetal Grove')).toBe(true);
  });

  test('a count of OTHER lands, with the entering land not yet among them', () => {
    const one = game();
    put(one, 'p1', 'Forest');
    // One other land is not two, so it still comes in tapped.
    expect(tappedOnEntry(one, 'Haunted Ridge')).toBe(true);

    const two = game();
    put(two, 'p1', 'Forest');
    put(two, 'p1', 'Plains');
    expect(tappedOnEntry(two, 'Haunted Ridge')).toBe(false);
  });

  test('a query about somebody ELSE’s life', () => {
    const healthy = game();
    expect(tappedOnEntry(healthy, 'Neglected Manor')).toBe(true);

    const hurt = game();
    must(hurt.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: -30 }));
    expect(tappedOnEntry(hurt, 'Neglected Manor')).toBe(false);
  });

  /**
   * ⚠️ THE INVERTED WORDING, normalised at parse time so there is ONE evaluator.
   * "enters tapped IF you control ≥2 other lands" is exactly "enters tapped
   * UNLESS you control ≤1 other lands", and doing that flip in the engine would
   * have meant a second place that knows what these clauses mean.
   */
  test('“If you control two or more other lands, this land enters tapped”', () => {
    const bare = game();
    expect(tappedOnEntry(bare, 'Lair of the Hydra')).toBe(false);

    const two = game();
    put(two, 'p1', 'Forest');
    put(two, 'p1', 'Plains');
    expect(tappedOnEntry(two, 'Lair of the Hydra')).toBe(true);
  });

  /**
   * ⚠️ **THIS TEST CHANGED SIDES, AND THE HISTORY IS THE POINT.** For one
   * milestone it read "a land that asks the PLAYER is refused": `Godless Shrine`
   * is "As this land enters, you may pay 2 life. If you don't, it enters
   * tapped." — a PROMPT, and reading it as a board query means the engine
   * declines to pay every time, silently, so the player never sees the choice
   * the card gives them (D90).
   *
   * The refusal was right for exactly as long as there was nowhere to ask.
   * D136 built `Awaiting.entersChoice`, so the same sentence is now a condition
   * with a real question behind it — see the suite below. What must NEVER come
   * back is the middle answer: reading the clause and deciding it for them.
   */
  test('a land that asks the PLAYER is a question now, not a refusal', () => {
    expect(ORACLE.byName('Godless Shrine')?.faces[0]?.entersTapped).toEqual({
      unless: { kind: 'payLife', life: 2 },
    });
    const g = game();
    const id = put(g, 'p1', 'Godless Shrine');
    // ⚠️ NOT TAPPED AND NOT UNTAPPED-AND-FORGOTTEN: asked.
    expect(g.state.priority.awaiting?.kind).toBe('entersChoice');
    expect(g.state.cards[id]?.tapped).toBe(false);
  });

  test('every conditional land still replays to the same hash', () => {
    const g = game();
    put(g, 'p1', 'Forest');
    put(g, 'p1', 'Sunpetal Grove');
    put(g, 'p1', 'Haunted Ridge');
    put(g, 'p1', 'Lair of the Hydra');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

/**
 * The QUESTION (D136). D135's refusal, built.
 *
 * ⚠️ **THE PERMANENT IS ALREADY ON THE BATTLEFIELD AND UNTAPPED while this
 * prompt is up**, which is the one thing to understand about these tests.
 * Suspending the fold until an answer arrived would mean a continuation living
 * in `GameState`; instead the entry happens, the question is asked, and the
 * answer appends either the payment or the tap. Nobody can act in the gap
 * because an `Awaiting` blocks every other intent — so a test that reads
 * `tapped` BEFORE answering is reading a state no player can act on, and gets
 * `false` every time.
 */
describe('enters tapped unless you PAY (CR 614.12)', () => {
  const LANDS = ['Godless Shrine', 'The Black Gate', 'Multiversal Passage', 'Plains', 'Forest'];

  function game(): Game {
    return startedGame({ players: 2, decks: [LANDS, LANDS] });
  }

  // ⚠️ NOT NAMED `promp`+`t` — `battery-anim.cjs` greps `src/` for a call to it
  // because that browser dialog THROWS in Electron, and a local helper by that
  // name trips the guard on a plain-text match. The guard is right and the name
  // was wrong; weakening a security-shaped check to keep a nicer identifier is
  // how a real hit gets missed later.
  function askedAbout(g: Game): Extract<NonNullable<Game['state']['priority']['awaiting']>, { kind: 'entersChoice' }> {
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'entersChoice') throw new Error(`expected an entersChoice question, got ${a?.kind ?? 'none'}`);
    return a;
  }

  test('the clause is a CONDITION now, and the cost is read off the card', () => {
    expect(ORACLE.byName('Godless Shrine')?.faces[0]?.entersTapped).toEqual({
      unless: { kind: 'payLife', life: 2 },
    });
    // ⚠️ THREE, and this is why `The Black Gate` is a fixture: a cost hardcoded
    // to 2 passes every test written against the shock lands alone.
    expect(ORACLE.byName('The Black Gate')?.faces[0]?.entersTapped).toEqual({
      unless: { kind: 'payLife', life: 3 },
    });
  });

  test('entering raises the prompt instead of tapping', () => {
    const g = game();
    const id = put(g, 'p1', 'Godless Shrine');
    const a = askedAbout(g);
    expect(a.player).toBe('p1');
    expect(a.source).toBe(id);
    expect(a.life).toBe(2);
    expect(a.label).toBe('Godless Shrine');
    // Untapped and on the battlefield, waiting on the answer.
    expect(g.state.cards[id]?.tapped).toBe(false);
    expect(g.state.zones.battlefield).toContain(id);
  });

  test('paying costs the life and leaves it untapped', () => {
    const g = game();
    const id = put(g, 'p1', 'Godless Shrine');
    const before = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: id, pay: true }));
    expect(g.state.players['p1']?.life).toBe(before - 2);
    expect(g.state.cards[id]?.tapped).toBe(false);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('declining taps it and costs nothing', () => {
    const g = game();
    const id = put(g, 'p1', 'Godless Shrine');
    const before = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: id, pay: false }));
    expect(g.state.players['p1']?.life).toBe(before);
    expect(g.state.cards[id]?.tapped).toBe(true);
    expect(g.state.priority.awaiting).toBeNull();
  });

  /**
   * ⚠️ CR 119.4 — you may pay N life only with a life total of at least N. A
   * player who cannot pay is not ASKED, because the prompt's "yes" would then be
   * an answer the handler must refuse, and a prompt whose obvious answer is
   * rejected is how a table wedges.
   */
  test('a player who cannot pay is never asked, and the land is tapped', () => {
    const g = game();
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -39 }));
    expect(g.state.players['p1']?.life).toBe(1);
    const id = put(g, 'p1', 'Godless Shrine');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[id]?.tapped).toBe(true);
  });

  /**
   * ⚠️ AT EXACTLY THE PRICE THE PAYMENT IS LEGAL, so this is `<` and not `<=`.
   * Paying to 0 loses the game to SBA 1 — which is the player's call, and an
   * engine that quietly declined on their behalf would be making it for them.
   */
  test('at exactly the price the choice is still offered', () => {
    const g = game();
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -38 }));
    const id = put(g, 'p1', 'Godless Shrine');
    expect(askedAbout(g).source).toBe(id);
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: id, pay: true }));
    expect(g.state.players['p1']?.life).toBe(0);
  });

  /**
   * THE QUEUE, for `commanderZoneChoice`'s reason (CR 903.9a): one `CardsMoved`
   * can carry several of these, and asking about one while silently tapping the
   * rest is half-execution.
   *
   * ⚠️ **NO INTENT PRODUCES A TWO-CARD BATTLEFIELD MOVE TODAY, and that is said
   * rather than papered over.** `ManualMoveCard` moves one; `ManualMoveZone`
   * goes only graveyard/exile → library/exile; resolution puts down the one
   * permanent that resolved. So the queue is reachable only from a card script
   * that puts two lands out at once — `NO_SCRIPTS` ships, so not from the
   * app either. It is built now because the alternative when it DOES become
   * reachable is a silently tapped land, and because a funnel is exactly where
   * that kind of gap hides (D128's dead `optional` flag, D134's dead
   * `ReplacementDef`).
   *
   * So this drives the two halves at the seams they are reachable at:
   * `applyReplacements` for the construction, `handle` for the pop. Not an
   * end-to-end test, and calling it one would be the claim this file exists to
   * avoid making.
   */
  test('the funnel QUEUES several, each with its own price', () => {
    const g = game();
    const a = findAnywhere(g, 'p1', 'Godless Shrine');
    const b = findAnywhere(g, 'p1', 'The Black Gate');
    const out = applyReplacements(g.state, ORACLE, NO_SCRIPTS, {
      t: 'CardsMoved',
      moves: [a, b].map((card) => ({
        card,
        from: { kind: 'hand' as const, player: 'p1' as const },
        to: { kind: 'battlefield' as const, player: 'p1' as const },
      })),
    });
    const set = out.find((e) => e.t === 'AwaitingSet');
    const awaiting = set?.t === 'AwaitingSet' ? set.awaiting : null;
    expect(awaiting?.kind).toBe('entersChoice');
    if (awaiting?.kind !== 'entersChoice') throw new Error('unreachable');
    expect(awaiting.queue).toHaveLength(1);
    // ⚠️ 2 and 3 — a queue entry that reused the head's cost is caught here, and
    // only here, because every other card of this shape in the format pays 2.
    expect([awaiting.life, awaiting.queue[0]?.life].sort()).toEqual([2, 3]);
    // ⚠️ And NOTHING is tapped in the same breath: a `PermanentsTapped` beside
    // the prompt would tap the card being asked about.
    expect(out.some((e) => e.t === 'PermanentsTapped')).toBe(false);
  });

  test('answering pops the queue and re-arms for the next', () => {
    const g = game();
    const a = findAnywhere(g, 'p1', 'Godless Shrine');
    const b = findAnywhere(g, 'p1', 'The Black Gate');
    const queued: GameState = {
      ...g.state,
      priority: {
        ...g.state.priority,
        awaiting: {
          kind: 'entersChoice',
          player: 'p1',
          source: a,
          life: 2,
          label: 'Godless Shrine',
          queue: [{ card: b, player: 'p1', life: 3, label: 'The Black Gate' }],
        },
      },
    };
    const result = handle(queued, { t: 'AnswerEntersChoice', player: 'p1', source: a, pay: false }, {
      oracle: ORACLE,
      scripts: NO_SCRIPTS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const set = result.events.find((e) => e.t === 'AwaitingSet');
    const next = set?.t === 'AwaitingSet' ? set.awaiting : null;
    expect(next).toMatchObject({ kind: 'entersChoice', source: b, life: 3, label: 'The Black Gate' });
    // The head was answered, so it is the one that got tapped.
    expect(result.events.some((e) => e.t === 'PermanentsTapped' && e.cards.includes(a))).toBe(true);
  });

  /**
   * ⚠️ **THE ONE THAT MUST STILL BE REFUSED.** `Multiversal Passage` reads "As
   * this land enters, choose a basic land type. Then you may pay 2 life. If you
   * don't, it enters tapped." — the pay clause is in there, and taking it would
   * charge the player 2 life while dropping the choice that decides what the
   * land taps for.
   */
  test('a card that CONTAINS the clause but says more is refused', () => {
    expect(ORACLE.byName('Multiversal Passage')?.faces[0]?.entersTapped).toBeNull();
    const g = game();
    const id = put(g, 'p1', 'Multiversal Passage');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[id]?.tapped).toBe(false);
  });

  test('both answers replay to the same hash', () => {
    for (const pay of [true, false]) {
      const g = game();
      const id = put(g, 'p1', 'Godless Shrine');
      must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: id, pay }));
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });

  /**
   * ⚠️ The DECISION is the one thing the consequences cannot show. Paying is a
   * `LifeChanged` like any other and declining is a `PermanentsTapped` like a
   * land tapped for mana, so without the marker the log could not say a question
   * had been asked at all.
   */
  test('the answer is on the log either way', () => {
    for (const pay of [true, false]) {
      const g = game();
      const id = put(g, 'p1', 'Godless Shrine');
      must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: id, pay }));
      const marker = g.log.find((e) => e.body.t === 'EntersChoiceAnswered');
      expect(marker?.body).toMatchObject({ card: id, player: 'p1', pay });
    }
  });
});

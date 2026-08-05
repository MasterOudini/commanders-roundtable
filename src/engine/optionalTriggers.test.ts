// "You may" — the first primitive of M6.3. See D128.
//
// ⚠️ WHAT WAS BROKEN: `TriggerDef.optional` has been in the script API since M3
// and `collectTriggers` has copied it onto every `PendingTrigger` for as long,
// and NOTHING anywhere branched on it. A "may" trigger fired unconditionally —
// half-execution in the one direction D90 forbids, doing something the player
// never chose.
//
// ⚠️ Driven with a REAL CARD, not a fixture trigger. `turn.test.ts`'s
// `upkeepTrigger` resolves to `[]`; a primitive proved against a script that
// does nothing is a primitive proved against itself. `Ajani's Mantra`'s whole
// printed text is the optional trigger, so accepting and declining are visible
// as a life total.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { AJANIS_MANTRA } from './testing/cardScripts';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { GameState } from './types/state';

const MANTRA = "Ajani's Mantra";

/** p1 with a Mantra on the battlefield, stopped on its first upkeep prompt. */
function atThePrompt(players = 2, script: CardScript = AJANIS_MANTRA): Game {
  const game = startedGame({ players, decks: [[MANTRA]], scripts: createRegistry([script]) });
  put(game, 'p1', MANTRA);
  advanceUntil(game, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
  return game;
}

function lifeOf(state: GameState, player: string): number {
  return state.players[player]?.life ?? -1;
}

function narration(game: Game): string[] {
  return game.log.flatMap((e) => (e.body.t === 'Narrated' ? [e.body.text] : []));
}

/** The same card with the flag off — what the engine did before D128. */
const MANDATORY: CardScript = {
  ...AJANIS_MANTRA,
  triggers: (AJANIS_MANTRA.triggers ?? []).map((t) => ({ ...t, optional: false })),
};

describe('optional ("may") triggers', () => {
  test('a may trigger STOPS on resolution and asks its controller', () => {
    const game = atThePrompt();
    const awaiting = game.state.priority.awaiting;
    expect(awaiting?.kind).toBe('optionalTrigger');
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('unreachable');

    expect(awaiting.player).toBe('p1');
    expect(awaiting.label).toBe("Ajani's Mantra — gain 1 life");
    // ⚠️ The prompt names the STACK OBJECT it is about, and it must be the one
    // still on the stack. An answer that named only a player could resolve
    // whatever happened to be on top by the time it arrived.
    expect(game.state.stack[game.state.stack.length - 1]?.id).toBe(awaiting.stackId);
    // Nothing has happened yet — that is the whole point of stopping.
    expect(lifeOf(game.state, 'p1')).toBe(40);
  });

  test('accepting runs the card, and says so', () => {
    const game = atThePrompt();
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the prompt');
    must(game.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: true }));

    expect(lifeOf(game.state, 'p1')).toBe(41);
    expect(game.state.priority.awaiting).toBeNull();
    expect(game.state.stack.map((s) => s.id)).not.toContain(awaiting.stackId);
    expect(game.log.some((e) => e.body.t === 'OptionalTriggerAnswered' && e.body.accept)).toBe(true);
    expect(narration(game)).toContain("Ana uses Ajani's Mantra — gain 1 life.");
  });

  test('declining runs NOTHING, and says that too', () => {
    const game = atThePrompt();
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the prompt');
    const lifeEvents = game.log.filter((e) => e.body.t === 'LifeChanged').length;
    must(game.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: false }));

    expect(lifeOf(game.state, 'p1')).toBe(40);
    // ⚠️ Asserted on the EVENT COUNT, not on the life total. A script that ran
    // and then had its effect undone somewhere else would leave the same 40.
    expect(game.log.filter((e) => e.body.t === 'LifeChanged').length).toBe(lifeEvents);
    expect(game.state.priority.awaiting).toBeNull();
    expect(game.state.stack.map((s) => s.id)).not.toContain(awaiting.stackId);
    expect(game.log.some((e) => e.body.t === 'OptionalTriggerAnswered' && !e.body.accept)).toBe(true);
    // ⚠️ A declined trigger and a trigger whose effect did nothing leave an
    // IDENTICAL board, so the log is the only place the difference can live.
    expect(narration(game)).toContain("Ana declines Ajani's Mantra — gain 1 life.");
    expect(narration(game)).toContain("Ajani's Mantra — gain 1 life resolves.");
  });

  /**
   * ⚠️ THE CHECK THAT PROVES THE PROMPT COMES FROM THE FLAG. The same card with
   * `optional: false` must not stop at all — otherwise D128 would have turned
   * every trigger in the game into a question, which is a far worse bug than the
   * one it fixes and one no other test here would notice.
   */
  test('a MANDATORY trigger is never asked about — it just happens', () => {
    const game = startedGame({ players: 2, decks: [[MANTRA]], scripts: createRegistry([MANDATORY]) });
    put(game, 'p1', MANTRA);
    // ⚠️ `turnNumber >= 4`, never "turn 3, draw step". A whole turn runs inside
    // one `pump()` when nobody can act, so a predicate naming one step samples a
    // moment that never appears between submitted intents — the first cut ran
    // the game to its natural end and read a life total of 63.
    advanceUntil(game, (s) => s.turn.turnNumber >= 4, 20_000);

    const fired = game.log.filter(
      (e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.label.startsWith("Ajani's Mantra"),
    ).length;
    expect(fired, 'the mandatory trigger never fired, so this proves nothing').toBeGreaterThan(0);
    expect(game.log.some((e) => e.body.t === 'OptionalTriggerAnswered')).toBe(false);
    expect(
      game.log.some(
        (e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'optionalTrigger',
      ),
    ).toBe(false);
    // It ran itself, once per firing, with nobody asked.
    expect(lifeOf(game.state, 'p1')).toBe(40 + fired);
  });

  test('only the controller is asked, and only on THEIR upkeep', () => {
    const game = atThePrompt(4);
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the prompt');
    expect(awaiting.player).toBe('p1');
    expect(game.state.turn.activePlayer).toBe('p1');
    expect(game.state.turn.step).toBe('upkeep');
  });

  test('another seat cannot answer it, and a stale stack id cannot either', () => {
    const game = atThePrompt();
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the prompt');

    const wrongSeat = game.submit({
      t: 'AnswerOptionalTrigger',
      player: 'p2',
      stackId: awaiting.stackId,
      accept: true,
    });
    expect(wrongSeat.ok).toBe(false);

    const wrongObject = game.submit({
      t: 'AnswerOptionalTrigger',
      player: 'p1',
      stackId: 's999',
      accept: true,
    });
    expect(wrongObject.ok).toBe(false);

    // The prompt survives both, which is what makes a rejection recoverable
    // rather than a wedge.
    expect(game.state.priority.awaiting?.kind).toBe('optionalTrigger');
    must(game.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: true }));
    expect(lifeOf(game.state, 'p1')).toBe(41);
  });

  /**
   * ⚠️ A DEPARTED PLAYER IS NOT ASKED. Their answer is not in doubt, and CR
   * 800.4a goes further still (their objects on the stack cease to exist, which
   * this engine does not model).
   *
   * ⚠️ Checked by DELETING the guard: this check fails by name — "a departed
   * player was asked a question nobody could answer" — and nothing else in the
   * file moves. It does not hang, because `simplestAnswer` cheerfully answers
   * for a seat that has conceded; whether a REAL client would is a property of
   * the client, which is exactly why the engine should not ask.
   */
  test('a controller who has left the game is not asked, and gains nothing', () => {
    const game = startedGame({ players: 4, decks: [[MANTRA]], scripts: createRegistry([AJANIS_MANTRA]) });
    holdEverywhere(game);
    put(game, 'p1', MANTRA);
    // Stop with the trigger ON the stack but before it resolves: everyone still
    // owes a priority pass in p1's upkeep.
    advanceUntil(game, (s) => s.stack.some((o) => o.kind === 'triggered'), 20_000);
    const lifeEvents = game.log.filter((e) => e.body.t === 'LifeChanged').length;
    must(game.submit({ t: 'Concede', player: 'p1' }));
    advanceUntil(game, (s) => !s.stack.some((o) => o.kind === 'triggered'), 20_000);

    expect(game.state.players['p1']?.hasLost).toBe(true);
    expect(
      game.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'optionalTrigger'),
      'a departed player was asked a question nobody could answer',
    ).toBe(false);
    // A concession changes life totals, so the assertion is on the ability
    // having emitted nothing rather than on any one number.
    expect(game.log.filter((e) => e.body.t === 'LifeChanged').length).toBe(lifeEvents);
  });

  /**
   * ⚠️ The primitive is part of `GameState` (the prompt lives on
   * `priority.awaiting`), so a game that answers one has to re-fold to the same
   * hash. The 500-seed gate says this at scale; this says it on the one card,
   * where a failure names itself.
   */
  test('a game that answers a may trigger still replays to the same hash', () => {
    for (const accept of [true, false]) {
      const game = atThePrompt();
      const awaiting = game.state.priority.awaiting;
      if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the prompt');
      must(game.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept }));
      advanceUntil(game, (s) => s.turn.turnNumber >= 5, 20_000);
      expect(stateHash(replay(game.log, game.seed)), `accept: ${accept}`).toBe(game.hash());
    }
  });
});

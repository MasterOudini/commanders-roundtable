// Putting counters on things — the third M6.3 primitive. See D130.
//
// ⚠️ TWO PATHS, AND ONLY ONE OF THEM WAS MISSING.
//
//   · A SPELL whose whole text is a counter clause needed the effect VOCABULARY
//     (`effectParse` + `effects.ts`), because a spell resolves through
//     `effectEvents` and nothing else. That is what this milestone built, and it
//     is the only part that moves `engineComplete`.
//   · A PERMANENT that puts counters needed NOTHING. `CountersChanged` has been
//     on the log since D107 and a `TriggerDef` returns `EventBody[]`, so
//     `Ajani's Pridemate` was scriptable in M3. D127 counted it as blocked
//     because its proxy for "could a script express you" is `parseEffects` —
//     the vocabulary for one-shot SPELLS, which has no bearing on scripts.
//
// The second is asserted here rather than argued, because a measurement
// correction that rests on "I read the code and it looked possible" is worth
// nothing.

import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { Game } from './game';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { AJANIS_MANTRA, AJANIS_PRIDEMATE } from './testing/cardScripts';
import {
  advanceUntil,
  battlefieldOf,
  find,
  fullControl,
  must,
  ORACLE,
  put,
  startedGame,
} from './testing/harness';
import { NO_SCRIPTS } from './scripts/registry';
import type { InstanceId } from './types/ids';

const SPELLS = ['Battlegrowth', 'Scar', 'Burst of Strength', 'Grizzly Bears', 'Typhoid Rats'];

function ptOf(game: Game, id: InstanceId): string {
  const d = derive(game.state, ORACLE, game.deps.scripts, id);
  return `${d.power}/${d.toughness}`;
}

/** Cast a spell from hand at a target, all the way through resolution. */
function castAt(game: Game, player: string, spell: string, target: InstanceId): void {
  const card = put(game, player, spell, 'hand');
  must(game.submit({ t: 'ManualAddMana', player, target: player, symbol: 'G', amount: 4 }));
  must(game.submit({ t: 'ManualAddMana', player, target: player, symbol: 'B', amount: 4 }));
  must(game.submit({ t: 'CastSpell', player, card }));
  const awaiting = game.state.priority.awaiting;
  if (awaiting?.kind === 'chooseTargets') {
    must(game.submit({ t: 'ChooseTargets', player, targets: [{ kind: 'card', id: target }] }));
  }
  advanceUntil(game, (s) => s.stack.length === 0, 20_000);
}

describe('counter effects — the spell path', () => {
  test('Battlegrowth resolves BY ITSELF and the creature grows', () => {
    const game = startedGame({ players: 2, decks: [SPELLS, SPELLS] });
    fullControl(game, 'p1');
    const bears = put(game, 'p1', 'Grizzly Bears');
    expect(ptOf(game, bears)).toBe('2/2');

    castAt(game, 'p1', 'Battlegrowth', bears);

    expect(game.state.cards[bears]?.counters['+1/+1']).toBe(1);
    // ⚠️ Read through `derive`, not off the counter map. Layer 7d is where a
    // +1/+1 counter becomes power and toughness, and a test that only checked
    // the map would pass on an engine that recorded counters and applied none —
    // which is precisely the half-execution `CounterKind` is closed against.
    expect(ptOf(game, bears)).toBe('3/3');
    // No manual wrench anywhere: the spell did this, not a Tier-3 tool.
    expect(game.log.some((e) => e.cause.kind === 'manual' && e.body.t === 'CountersChanged')).toBe(false);
  });

  /**
   * ⚠️ LETHALITY IS THE SBA'S JOB, exactly as it is for damage (D90). `Scar`
   * emits one `CountersChanged` and nothing else; layer 7d makes the 1/1 a 0/0
   * and `checkStateBasedActions` bins it. A second "is this lethal" inside
   * `effects.ts` would eventually disagree with combat.
   */
  test('Scar puts a -1/-1 counter, and a 1/1 dies to the state-based action', () => {
    const game = startedGame({ players: 2, decks: [SPELLS, SPELLS] });
    fullControl(game, 'p1');
    const rats = put(game, 'p2', 'Typhoid Rats');
    expect(ptOf(game, rats)).toBe('1/1');

    castAt(game, 'p1', 'Scar', rats);

    expect(battlefieldOf(game, 'p2')).not.toContain(rats);
    expect(game.state.zones.graveyard['p2']).toContain(rats);
  });

  /**
   * ⚠️ THE ANCHOR, DOING REAL WORK. `Burst of Strength` is "Put a +1/+1 counter
   * on target creature AND UNTAP IT." — ONE sentence, so the `assisted` rule
   * never sees a second clause to refuse. Only the `$` at the end of the pattern
   * stops the parser executing two thirds of the card and calling it done, and
   * that is the D90 failure this vocabulary is closed against.
   */
  test('Burst of Strength is NOT understood — one sentence, two effects', () => {
    const card = ORACLE.byName('Burst of Strength');
    if (!card) throw new Error('no Burst of Strength fixture');
    const face = card.faces[0];
    expect(face?.oracleText).toBe('Put a +1/+1 counter on target creature and untap it.');
    expect(face?.effectMode).toBe('manual');
    expect(face?.effects).toEqual([]);
  });

  test('Battlegrowth and Scar are understood COMPLETELY', () => {
    for (const [name, kind, amount] of [
      ['Battlegrowth', '+1/+1', 1],
      ['Scar', '-1/-1', 1],
    ] as const) {
      const face = ORACLE.byName(name)?.faces[0];
      expect(face?.effectMode, name).toBe('auto');
      expect(face?.effects.length, name).toBe(1);
      expect(face?.effects[0]?.kind, name).toBe('putCounters');
      expect(face?.effects[0]?.counterKind, name).toBe(kind);
      expect(face?.effects[0]?.amount, name).toBe(amount);
    }
  });

  test('a counter spell that resolves still replays to the same hash', () => {
    const game = startedGame({ players: 2, decks: [SPELLS, SPELLS] });
    fullControl(game, 'p1');
    const bears = put(game, 'p1', 'Grizzly Bears');
    castAt(game, 'p1', 'Battlegrowth', bears);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

describe('counter effects — the script path, which needed nothing', () => {
  /**
   * ⚠️ **THE MEASUREMENT CORRECTION, ASSERTED.** This registry is built from
   * `AJANIS_PRIDEMATE` alone and the engine is otherwise untouched: no widened
   * vocabulary is involved, because a `TriggerDef` returns events directly. If
   * this passes, the 981 permanents D127 filed under `effect:counter` for their
   * triggered and activated text were never blocked on a primitive at all —
   * they were blocked on M6.4 writing their scripts.
   */
  test('a permanent puts counters through a script, with no vocabulary at all', () => {
    const scripts = createRegistry([AJANIS_PRIDEMATE]);
    const game = startedGame({ players: 2, decks: [["Ajani's Pridemate"]], scripts });
    const mate = put(game, 'p1', "Ajani's Pridemate");
    expect(ptOf(game, mate)).toBe('2/2');

    // Gain life the plainest way there is — a Tier-3 tool — so the only thing
    // under test is the trigger reading `LifeChanged` and returning counters.
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
    advanceUntil(game, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);

    expect(game.state.cards[mate]?.counters['+1/+1']).toBe(1);
    expect(ptOf(game, mate)).toBe('3/3');
  });

  test('and it ignores life LOST, which is the other half of "whenever you gain"', () => {
    const scripts = createRegistry([AJANIS_PRIDEMATE]);
    const game = startedGame({ players: 2, decks: [["Ajani's Pridemate"]], scripts });
    const mate = put(game, 'p1', "Ajani's Pridemate");
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -3 }));
    // …and somebody ELSE gaining is not "you" either.
    must(game.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: 5 }));
    advanceUntil(game, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);

    expect(game.state.cards[mate]?.counters['+1/+1']).toBeUndefined();
    expect(ptOf(game, mate)).toBe('2/2');
  });

  /**
   * ⚠️ Two real cards on one bus: `Ajani's Mantra` is an OPTIONAL trigger
   * (D128), so the life only arrives when the player accepts — and the Pridemate
   * fires on the `LifeChanged` the other script emitted. A script's own events
   * go through `applyBatch` like any others, so `collectTriggers` sees them;
   * that is what makes card interaction work at all, and nothing had ever tested
   * it because nothing had ever registered two scripts.
   */
  test('one script triggers off another script’s event', () => {
    const scripts = createRegistry([AJANIS_MANTRA, AJANIS_PRIDEMATE]);
    const game = startedGame({
      players: 2,
      decks: [["Ajani's Mantra", "Ajani's Pridemate"]],
      scripts,
    });
    const mate = put(game, 'p1', "Ajani's Pridemate");
    put(game, 'p1', "Ajani's Mantra");

    // p1's next upkeep. Accepting the Mantra gains 1 life, which the Pridemate
    // must see.
    advanceUntil(game, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const awaiting = game.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the may prompt');
    must(game.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: true }));
    advanceUntil(game, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);

    expect(game.state.players['p1']?.life).toBe(41);
    expect(game.state.cards[mate]?.counters['+1/+1']).toBe(1);
    expect(ptOf(game, mate)).toBe('3/3');
  });

  test('with NO script registered the same board does nothing', () => {
    const game = startedGame({
      players: 2,
      decks: [["Ajani's Pridemate"]],
      scripts: NO_SCRIPTS,
    });
    const mate = put(game, 'p1', "Ajani's Pridemate");
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
    advanceUntil(game, (s) => s.stack.length === 0, 20_000);
    expect(game.state.cards[mate]?.counters['+1/+1']).toBeUndefined();
    expect(find(game, 'p1', 'battlefield', "Ajani's Pridemate")).toBe(mate);
  });
});

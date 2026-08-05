// Creating tokens — the fourth M6.3 primitive, and the one that needed a
// RESOLVER before it could need an effect. See D133.
//
// ⚠️ WHAT WAS MISSING WAS NEVER THE EVENT. `TokenCreated` has been on the log
// since M3. What no part of this app could do was say WHICH token: the event
// needs an `oracleId` and a `printingId`, and "a 1/1 white Soldier creature
// token" is neither. `tokenParse.ts` reads the description, `tokenTable.ts`
// bakes the answer at build time (D132's option B), and only then is there
// something for an effect to emit.

import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { Game } from './game';
import { replay, stateHash } from './log';
import { advanceUntil, battlefieldOf, fullControl, must, ORACLE, put, startedGame } from './testing/harness';
import type { InstanceId } from './types/ids';

const DECK = ['Raise the Alarm', 'Servo Exhibition', 'Slime Molding', 'Forest', 'Plains'];

function tokensOf(game: Game, player: string): InstanceId[] {
  return battlefieldOf(game, player).filter((id) => game.state.cards[id]?.isToken === true);
}

function describeCard(game: Game, id: InstanceId): string {
  const d = derive(game.state, ORACLE, game.deps.scripts, id);
  return `${d.name} ${d.power}/${d.toughness} ${d.colors.join('') || 'C'} ${d.typeLine.raw}`;
}

/** Cast a spell from hand, all the way through resolution. */
function cast(game: Game, player: string, spell: string): void {
  const card = put(game, player, spell, 'hand');
  must(game.submit({ t: 'ManualAddMana', player, target: player, symbol: 'W', amount: 6 }));
  must(game.submit({ t: 'ManualAddMana', player, target: player, symbol: 'G', amount: 6 }));
  must(game.submit({ t: 'CastSpell', player, card }));
  advanceUntil(game, (s) => s.stack.length === 0, 20_000);
}

describe('creating tokens', () => {
  test('Raise the Alarm resolves BY ITSELF and puts two real Soldiers down', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    fullControl(game, 'p1');
    expect(tokensOf(game, 'p1')).toHaveLength(0);

    cast(game, 'p1', 'Raise the Alarm');

    const tokens = tokensOf(game, 'p1');
    expect(tokens).toHaveLength(2);
    // ⚠️ Read through `derive`, which needs the PRINTING to be in the oracle. A
    // token whose printing the pool does not hold derives to the inert
    // unknown-printing object — no name, a 0/0 — so this assertion is the one
    // that would catch the whole class of "the card resolved and made a blank".
    for (const id of tokens) {
      expect(describeCard(game, id)).toBe('Soldier 1/1 W Token Creature — Soldier');
    }
    // Distinct instances, not one card counted twice.
    expect(new Set(tokens).size).toBe(2);
  });

  test('a colourless artifact creature token keeps BOTH card types', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    fullControl(game, 'p1');
    cast(game, 'p1', 'Servo Exhibition');

    const tokens = tokensOf(game, 'p1');
    expect(tokens).toHaveLength(2);
    expect(describeCard(game, tokens[0] as InstanceId)).toBe(
      'Servo 1/1 C Token Artifact Creature — Servo',
    );
  });

  /**
   * ⚠️ THE NEGATIVE CASE, and it is the whole reason the resolver refuses rather
   * than guesses. `Slime Molding` is "Create an X/X green Ooze creature token."
   * — X is not known at parse time, so there is no token to name, so the
   * sentence is not understood and the spell does not run by itself. Guessing a
   * size would put a creature on the battlefield that the card never described.
   */
  test('an X/X token is not understood, and the spell does not run itself', () => {
    const face = ORACLE.byName('Slime Molding')?.faces[0];
    expect(face?.oracleText).toBe('Create an X/X green Ooze creature token.');
    expect(face?.effectMode).toBe('manual');
    expect(face?.effects).toEqual([]);
  });

  test('the two that ARE understood say so, with the printing baked in', () => {
    for (const [name, count] of [
      ['Raise the Alarm', 2],
      ['Servo Exhibition', 2],
    ] as const) {
      const face = ORACLE.byName(name)?.faces[0];
      expect(face?.effectMode, name).toBe('auto');
      expect(face?.effects.length, name).toBe(1);
      const effect = face?.effects[0];
      expect(effect?.kind, name).toBe('createToken');
      expect(effect?.amount, name).toBe(count);
      // ⚠️ RESOLVED AT BUILD TIME. The spec carries the printing, so nothing at
      // resolution time has to look one up — which is what keeps `effectMode` a
      // property of the card rather than of whoever else is at the table.
      expect(effect?.token?.printingId, name).toBeTruthy();
      expect(effect?.self, name).toBe(true);
    }
  });

  test('the tokens belong to the caster, not to the table', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    fullControl(game, 'p1');
    cast(game, 'p1', 'Raise the Alarm');
    expect(tokensOf(game, 'p2')).toHaveLength(0);
    for (const id of tokensOf(game, 'p1')) {
      expect(game.state.cards[id]?.controller).toBe('p1');
      expect(game.state.cards[id]?.owner).toBe('p1');
    }
  });

  /**
   * ⚠️ ONE ALLOCATOR ACROSS THE WHOLE RESOLUTION. Two tokens starting from
   * `state.counters.instance + 1` independently would name the same card twice
   * and the reducer would overwrite the first with the second — one Soldier
   * where the card says two, silently.
   */
  test('two tokens get two instance ids', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    fullControl(game, 'p1');
    cast(game, 'p1', 'Raise the Alarm');
    const created = game.log.flatMap((e) => (e.body.t === 'TokenCreated' ? [e.body.card] : []));
    expect(created).toHaveLength(2);
    expect(new Set(created).size).toBe(2);
  });

  test('a game that creates tokens still replays to the same hash', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    fullControl(game, 'p1');
    cast(game, 'p1', 'Raise the Alarm');
    cast(game, 'p1', 'Servo Exhibition');
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

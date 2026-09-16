// D458 - BOAST (CR 702.142): "Boast — <cost>: <effect>" is an activated ability activated only if THIS creature
// attacked this turn, and only once each turn. The parser reads the word into `ActivatedAbility.boast` (and the
// printed once-each-turn rule into `oncePerTurn`), charging the cost behind it; the turn record remembers WHICH
// creatures attacked (`TurnMemory.attackerIds`, beside the count Raid reads, emptied with the record each turn);
// `legal.ts` withholds and `handlers.ts` refuses a boast whose source is not among them, before any cost. Proven on
// Fearless Pup with an inline def (what a generated row registers): refused in the main phase, offered and pumped
// once it attacked, the second attempt refused for the once-each-turn half, refused again on a later turn it did
// not attack, the replay hash.

import { describe, expect, test } from 'vitest';
import { FEARLESS_PUP } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { derive } from './derive';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const PUP_DEF: CardScript = {
  oracleId: FEARLESS_PUP.oracleId,
  name: FEARLESS_PUP.name,
  activated: [
    {
      ref: `${FEARLESS_PUP.oracleId}#a0`,
      text: (FEARLESS_PUP.faces[0]?.oracleText ?? '').split('\n')[1] ?? '',
      resolve: (ctx, self): readonly EventBody[] => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
const SCRIPTS = createRegistry([PUP_DEF]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(SCRIPTS);
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}
function mana(g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
}
function offered(g: Game, card: InstanceId): boolean {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === card && a.abilityIndex === 0);
}
function toMain(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
}
function attackWith(g: Game, card: InstanceId, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
  settle(g);
}

describe('D458 - the parse', () => {
  test('the boast word is read into the flag with the once-each-turn rule, and the cost behind it is charged', () => {
    const a = ORACLE.byName('Fearless Pup')?.faces[0]?.activated[0];
    expect(a?.boast).toBe(true);
    expect(a?.oncePerTurn).toBe(true);
    expect(a?.costText).toBe('Boast — {2}{R}');
    expect(a?.manaCost?.generic).toBe(2);
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
    expect(a?.exhaust).toBeUndefined();
  });
});

function armed(): { g: Game; pup: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Fearless Pup', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const pup = put(g, 'p1', 'Fearless Pup');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  toMain(g, 3);
  return { g, pup, bears };
}

describe('D458 - boast, offered to the creature that attacked (Fearless Pup)', () => {
  test('refused in the main phase; offered and pumped once it attacked; the second attempt refused this turn', () => {
    const { g, pup } = armed();
    expect(offered(g, pup)).toBe(false);
    mana(g, 'C', 2);
    mana(g, 'R', 1);
    const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: pup, abilityIndex: 0 });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe('timingRestriction');
    attackWith(g, pup, 3);
    expect(g.state.turn.memory.attackerIds).toEqual([pup]);
    expect(offered(g, pup)).toBe(true);
    // The pool emptied on the way into combat (CR 500.4): paid again where the boast is activated.
    mana(g, 'C', 2);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pup, abilityIndex: 0 }));
    expect(g.state.stack.some((o) => o.boast === true)).toBe(true);
    settle(g);
    expect(pt(g, pup)).toEqual([3, 1]);
    expect(offered(g, pup)).toBe(false);
    mana(g, 'C', 2);
    mana(g, 'R', 1);
    const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: pup, abilityIndex: 0 });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('timingRestriction');
    expect(pt(g, pup)).toEqual([3, 1]);
  });

  test('another creature attacking is not this one: the Bears alone earns the Pup nothing', () => {
    const { g, pup, bears } = armed();
    attackWith(g, bears, 3);
    expect(g.state.turn.memory.attackerIds).toEqual([bears]);
    expect(offered(g, pup)).toBe(false);
    mana(g, 'C', 2);
    mana(g, 'R', 1);
    const not = g.submit({ t: 'ActivateAbility', player: 'p1', card: pup, abilityIndex: 0 });
    expect(not.ok).toBe(false);
  });

  test('the record is the turn own: a later turn without an attack refuses it again', () => {
    const { g, pup } = armed();
    attackWith(g, pup, 3);
    mana(g, 'C', 2);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pup, abilityIndex: 0 }));
    settle(g);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    toMain(g, 5);
    expect(g.state.turn.memory.attackerIds).toEqual([]);
    expect(offered(g, pup)).toBe(false);
    expect(pt(g, pup)).toEqual([1, 1]);
  });

  test('replays to the same hash', () => {
    const { g, pup } = armed();
    attackWith(g, pup, 3);
    mana(g, 'C', 2);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pup, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

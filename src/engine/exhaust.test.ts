// D457 - EXHAUST (CR 702.178): "Exhaust — <cost>: <effect>" is an activated ability an object may activate ONCE.
// The parser reads the word into `ActivatedAbility.exhaust` and charges the cost behind it (the word itself is a
// keyword whose rule is not printed, so it was never on the ability-word list, D342); the reducer stamps the source's
// `CardInstance.exhausted` as the ability goes on the stack (the stack object says `exhaust`); `legal.ts` withholds
// and `handlers.ts` refuses a used one for the rest of the object's life - the memory outlives the turn and is
// cleared with the battlefield fields, so a NEW object (CR 400.7) may exhaust again. Proven on Prowcatcher
// Specialist with an inline def (what a generated row registers): two counters once, the second attempt refused
// on the same turn and on the next, the offer gone, a bounced-and-returned copy offered again, the replay hash.

import { describe, expect, test } from 'vitest';
import { PROWCATCHER_SPECIALIST } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SPECIALIST_DEF: CardScript = {
  oracleId: PROWCATCHER_SPECIALIST.oracleId,
  name: PROWCATCHER_SPECIALIST.name,
  activated: [
    {
      ref: `${PROWCATCHER_SPECIALIST.oracleId}#a0`,
      text: (PROWCATCHER_SPECIALIST.faces[0]?.oracleText ?? '').split('\n')[1] ?? '',
      resolve: (ctx, self): readonly EventBody[] => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 2 }] }];
      },
    },
  ],
};
const SCRIPTS = createRegistry([SPECIALIST_DEF]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
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

describe('D457 - the parse', () => {
  test('the exhaust word is read into the flag and the cost behind it is charged', () => {
    const a = ORACLE.byName('Prowcatcher Specialist')?.faces[0]?.activated[0];
    expect(a?.exhaust).toBe(true);
    expect(a?.costText).toBe('Exhaust — {3}{R}');
    expect(a?.manaCost?.generic).toBe(3);
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
    expect(a?.oncePerTurn).toBe(false);
    // A printed ability without the word carries no flag.
    expect(ORACLE.byName('Grizzly Bears')?.faces[0]?.activated.some((x) => x.exhaust)).toBe(false);
  });
});

function armed(): { g: Game; spec: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Prowcatcher Specialist', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const spec = put(g, 'p1', 'Prowcatcher Specialist');
  settle(g);
  toMain(g, 3);
  return { g, spec };
}

describe('D457 - exhaust, charged once (Prowcatcher Specialist)', () => {
  test('the first activation resolves and stamps the memory; the second is refused and no longer offered', () => {
    const { g, spec } = armed();
    expect(offered(g, spec)).toBe(true);
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 }));
    expect(g.state.cards[spec]?.exhausted).toEqual([`${PROWCATCHER_SPECIALIST.oracleId}#a0`]);
    expect(g.state.stack.some((o) => o.exhaust === true)).toBe(true);
    settle(g);
    expect(g.state.cards[spec]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(offered(g, spec)).toBe(false);
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('timingRestriction');
    expect(g.state.cards[spec]?.counters['+1/+1'] ?? 0).toBe(2);
  });

  test('the memory outlives the turn: refused on the next turn too', () => {
    const { g, spec } = armed();
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 }));
    settle(g);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    toMain(g, 5);
    expect(offered(g, spec)).toBe(false);
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    const later = g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 });
    expect(later.ok).toBe(false);
    expect(g.state.cards[spec]?.exhausted).toHaveLength(1);
  });

  test('a new object starts over: bounced and returned, it is offered again', () => {
    const { g, spec } = armed();
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 }));
    settle(g);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spec, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spec, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[spec]?.exhausted).toBeUndefined();
    expect(g.state.cards[spec]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(offered(g, spec)).toBe(true);
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 }));
    settle(g);
    expect(g.state.cards[spec]?.counters['+1/+1'] ?? 0).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, spec } = armed();
    mana(g, 'C', 3);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spec, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

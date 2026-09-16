// D472 - THE LOYALTY ABILITY (CR 606): the parser reads `+2` / `−1` / `0` into `ActivatedAbility.loyaltyCost` and the
// ability is payable; `legal.ts` offers it once a turn per PERMANENT at sorcery speed, a negative cost only with the
// counters to pay it (606.5); `handlers.ts` refuses by the same rules and charges the cost as `CountersChanged loyalty`
// in the cost batch; the reducer records the permanent's activation for the turn. Proven on Jace Beleren with an inline
// def (what a generated row registers): +2 draws for each player and lands on 5, a second loyalty ability the same turn
// refused and unoffered, −1 the next turn with a target, −10 unpayable (not offered, refused), the sorcery timing, a
// planeswalker at 0 loyalty gone by state-based action, the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { drawEvents } from './effects';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const JACE = ORACLE.byName('Jace Beleren');
if (!JACE) throw new Error('Jace Beleren is not in the fixtures');
const LINES = (JACE.faces[0]?.oracleText ?? '').split('\n');

const JACE_DEF: CardScript = {
  oracleId: JACE.oracleId,
  name: JACE.name,
  activated: [
    {
      ref: `${JACE.oracleId}#a0`,
      text: LINES[0] ?? '',
      resolve: (ctx): readonly EventBody[] => ctx.state.seating.flatMap((p) => drawEvents(ctx.state, p, 1)),
    },
    {
      ref: `${JACE.oracleId}#a1`,
      text: LINES[1] ?? '',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const t = obj.targets[0];
        return t && t.kind === 'player' ? drawEvents(ctx.state, t.id, 1) : [];
      },
    },
  ],
};
const SCRIPTS = createRegistry([JACE_DEF]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function toMain(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
}
function loyalty(g: Game, id: InstanceId): number {
  return g.state.cards[id]?.counters['loyalty'] ?? 0;
}
function offered(g: Game, id: InstanceId, index: number): boolean {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === id && a.abilityIndex === index);
}
function hand(g: Game, p: 'p1' | 'p2'): number {
  return (g.state.zones.hand[p] ?? []).length;
}

function armed(): { g: Game; jace: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Jace Beleren'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const jace = put(g, 'p1', 'Jace Beleren');
  settle(g);
  toMain(g, 3);
  return { g, jace };
}

describe('D472 - the parse', () => {
  test('the three costs read as numbers, payable, sorcery-speed; an X cost stays unpaid', () => {
    const a = JACE.faces[0]?.activated ?? [];
    expect(a.map((x) => x.loyaltyCost)).toEqual([2, -1, -10]);
    expect(a.every((x) => x.isLoyalty && x.payable && x.sorceryOnly)).toBe(true);
    const grist = ORACLE.byName('Grist, the Hunger Tide')?.faces[0]?.activated ?? [];
    expect(grist.length).toBeGreaterThan(0);
    expect(grist.every((x) => x.isLoyalty)).toBe(true);
  });
});

describe('D472 - Jace Beleren', () => {
  test('+2 draws for each player and lands on 5; a second loyalty ability the same turn is refused and unoffered', () => {
    const { g, jace } = armed();
    expect(loyalty(g, jace)).toBe(3);
    expect(offered(g, jace, 0)).toBe(true);
    expect(offered(g, jace, 1)).toBe(true);
    // −10 needs ten counters: not offered.
    expect(offered(g, jace, 2)).toBe(false);
    const h1 = hand(g, 'p1');
    const h2 = hand(g, 'p2');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 0 }));
    // The cost is paid as the ability goes on the stack.
    expect(loyalty(g, jace)).toBe(5);
    settle(g);
    expect(hand(g, 'p1')).toBe(h1 + 1);
    expect(hand(g, 'p2')).toBe(h2 + 1);
    expect(offered(g, jace, 1)).toBe(false);
    const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 1, targets: [{ kind: 'player', id: 'p1' }] });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('timingRestriction');
    const tenth = g.submit({ t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 2, targets: [{ kind: 'player', id: 'p2' }] });
    expect(tenth.ok).toBe(false);
  });

  test('−1 the next turn with a target; then the counters run out for a second −1 and it is refused', () => {
    const { g, jace } = armed();
    const h2 = hand(g, 'p2');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 1, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(loyalty(g, jace)).toBe(2);
    expect(hand(g, 'p2')).toBe(h2 + 1);
    toMain(g, 5);
    expect(offered(g, jace, 1)).toBe(true);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: jace, kind: 'loyalty', delta: -2 }));
    settle(g);
    // At 0 loyalty the state-based action takes the planeswalker.
    expect(g.state.cards[jace]?.zone.kind).toBe('graveyard');
  });

  test('sorcery speed: not offered and refused on the opponent`s turn', () => {
    const { g, jace } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    expect(offered(g, jace, 0)).toBe(false);
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('timingRestriction');
  });

  test('replays to the same hash', () => {
    const { g, jace } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

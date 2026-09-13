// D423 - THE KICKED INSTEAD (CR 702.33): `If this spell was kicked, <clause> instead.` replaces the clause before
// it on a kicked spell - the spell's own damage at the previous target (Burst Lightning), a referent pump (Might of
// Murasa, Gift of Growth after an untap), a token count (Saproling Migration); unkicked, the base runs and the
// instead clause says it did nothing.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { derive } from './derive';
import { advanceUntil, deps as depsOf, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';
const D = createRegistry([]);
function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const power = (g: Game, id: InstanceId): number | null => derive(g.state, depsOf(D).oracle, depsOf(D).scripts, id).power;
const tokens = (g: Game, from: number): number => g.log.slice(from).filter((e) => e.body.t === 'TokenCreated').length;
const said = (g: Game, from: number, needle: string): boolean => g.log.slice(from).some((e) => e.body.t === 'Narrated' && e.body.text.includes(needle));
function armed(p1: readonly string[], p2: readonly string[] = [CYCLOPS]): Game {
  const g = startedGame({ players: 2, decks: [[...p1], [...p2]], scripts: D });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
  return g;
}

describe('D423 - the kicked instead', () => {
  test('Burst Lightning: 2 damage unkicked, 4 instead when kicked - the base skipped and said so', () => {
    for (const kicked of [0, 1]) {
      const g = armed(['Burst Lightning'], ['Air Elemental']);
      const target = put(g, 'p2', 'Air Elemental');
      settle(g);
      const bolt = put(g, 'p1', 'Burst Lightning', 'hand');
      mana(g, 'R', 1); if (kicked) mana(g, 'C', 4);
      const n0 = g.log.length;
      must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: target }], ...(kicked ? { kicked: 1 } : {}) }));
      settle(g);
      if (kicked) {
        expect(g.state.cards[target]?.zone.kind, 'four damage kills the 4/4').toBe('graveyard');
        expect(said(g, n0, 'is replaced')).toBe(true);
      } else {
        expect(g.state.cards[target]?.damage, 'two damage unkicked').toBe(2);
        expect(said(g, n0, 'was not kicked')).toBe(true);
      }
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });
  test('Might of Murasa: +3/+3 unkicked, +5/+5 instead when kicked; Gift of Growth untaps and pumps +4/+4 kicked', () => {
    const g = armed(['Might of Murasa', 'Gift of Growth', BEARS]);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    const might = put(g, 'p1', 'Might of Murasa', 'hand');
    mana(g, 'G', 1); mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: might, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(power(g, bears)).toBe(5);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
    expect(power(g, bears)).toBe(2);
    const might2 = put(g, 'p1', 'Might of Murasa', 'hand');
    mana(g, 'G', 2); mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: might2, targets: [{ kind: 'card', id: bears }], kicked: 1 }));
    settle(g);
    expect(power(g, bears), 'kicked: +5/+5, not +3/+3').toBe(7);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    const gift = put(g, 'p1', 'Gift of Growth', 'hand');
    mana(g, 'G', 1); mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gift, targets: [{ kind: 'card', id: bears }], kicked: 1 }));
    settle(g);
    expect(g.state.cards[bears]?.tapped, 'the untap is not replaced').toBe(false);
    expect(power(g, bears), 'the pump is: +4/+4 on top of +5/+5').toBe(11);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
  test('Saproling Migration: two tokens unkicked, four instead when kicked', () => {
    const g = armed(['Saproling Migration', 'Saproling Migration']);
    const a = put(g, 'p1', 'Saproling Migration', 'hand');
    mana(g, 'G', 1); mana(g, 'C', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: a }));
    settle(g);
    expect(tokens(g, n0)).toBe(2);
    const b = put(g, 'p1', 'Saproling Migration', 'hand');
    mana(g, 'G', 1); mana(g, 'C', 5);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: b, kicked: 1 }));
    settle(g);
    expect(tokens(g, n1)).toBe(4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

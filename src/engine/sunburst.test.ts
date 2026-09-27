// D565 - SUNBURST (CR 702.44a): "If this object is entering the battlefield from the stack as a creature, it enters with a
// +1/+1 counter on it for each color of mana spent to cast it. Otherwise, it enters with a charge counter on it for each
// color of mana spent to cast it." The cast counts the colours its own ManaSpent events spent onto the stack object, the
// resolution carries the count onto the entry move and the entry counters add them. What is proven here: the reading (the
// keyword the engine's); Skyreach Manta cast with white, blue and black mana among its five enters with three +1/+1
// counters; Baton of Courage (not a creature) cast with red and green enters with two charge counters; Suntouched Myr cast
// with colourless mana alone gets none and dies as a 0/0; a Manta put onto the battlefield without being cast gets none;
// the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const FILL = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const counters = (g: Game, id: InstanceId, kind: string): number => g.state.cards[id]?.counters?.[kind] ?? 0;

function armed(name: string): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[name, name, ...FILL], [...FILL]] });
  settle(g);
  holdEverywhere(g);
  const card = put(g, 'p1', name, 'hand');
  main3(g);
  return { g, card };
}

describe('D565 - sunburst', () => {
  test('the reading: the keyword the engine' + "'" + 's', () => {
    const c = deps().oracle.byName('Skyreach Manta');
    if (!c) throw new Error('no fixture');
    expect(faceOf(c, 0).keywords).toContain('sunburst');
  });

  test('Skyreach Manta cast with white, blue and black among its five enters with three +1/+1 counters', () => {
    const { g, card } = armed('Skyreach Manta');
    mana(g, 'W', 1);
    mana(g, 'U', 1);
    mana(g, 'B', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(counters(g, card, '+1/+1'), 'three colours spent').toBe(3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Baton of Courage (not a creature) cast with red and green enters with two charge counters', () => {
    const { g, card } = armed('Baton of Courage');
    mana(g, 'R', 1);
    mana(g, 'G', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(counters(g, card, 'charge')).toBe(2);
    expect(counters(g, card, '+1/+1')).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Suntouched Myr cast with colourless mana alone gets none and dies as a 0/0', () => {
    const { g, card } = armed('Suntouched Myr');
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind, 'no colour spent - a 0/0').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a Manta put onto the battlefield without being cast gets none', () => {
    const { g } = armed('Skyreach Manta');
    const other = put(g, 'p1', 'Skyreach Manta', 'battlefield');
    settle(g);
    expect(counters(g, other, '+1/+1')).toBe(0);
    expect(g.state.cards[other]?.zone.kind, 'a 0/0 dies').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

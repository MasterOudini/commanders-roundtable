// D550 - SPLIT SECOND (CR 702.61a/b): "As long as this spell is on the stack, players can't cast spells or activate
// abilities that aren't mana abilities." A Tier-2 keyword and one predicate (`splitSecondOnStack`) the offer and the host
// both ask. What is proven here: the keyword and the spells complete; Sudden Shock on the stack - the opponent is offered
// no cast and no activation (the mana taps stay), and the host refuses the cast they try; once it resolves the lock is
// gone; the replay hash.
import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions, splitSecondOnStack } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';

const MOUNTAINS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };

describe('D550 - split second', () => {
  test('the keyword, and the spells complete', () => {
    for (const name of ['Sudden Shock', 'Krosan Grip']) {
      expect(faceNamed(name).keywords, name).toContain('splitSecond');
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error('no fixture ' + name);
      expect(engineCompleteness(card), name).toEqual({ complete: true, leftover: [] });
    }
  });

  test('Sudden Shock on the stack: no cast and no activation offered or allowed, the mana taps stay; resolved, the lock is gone', () => {
    const g = startedGame({ players: 2, decks: [['Sudden Shock', ...MOUNTAINS], ['Lightning Bolt', ...MOUNTAINS]] });
    holdEverywhere(g);
    const shock = put(g, 'p1', 'Sudden Shock', 'hand');
    const bolt = put(g, 'p2', 'Lightning Bolt', 'hand');
    put(g, 'p2', 'Mountain');
    main3(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(splitSecondOnStack(g.state, g.deps.oracle)).toBe(true);
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    const offered = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p2');
    expect(offered.some((a) => a.t === 'CastSpell'), 'no cast offered').toBe(false);
    expect(offered.some((a) => a.t === 'ActivateAbility'), 'no activation offered').toBe(false);
    expect(offered.some((a) => a.t === 'TapForMana'), 'the mana taps stay').toBe(true);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 1 }));
    const tried = g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'player', id: 'p1' }] });
    expect(tried.ok, 'the host refuses the cast').toBe(false);
    const life2 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    settle(g);
    expect(g.state.players.p2?.life, 'Sudden Shock resolved').toBe(life2 - 2);
    expect(splitSecondOnStack(g.state, g.deps.oracle)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

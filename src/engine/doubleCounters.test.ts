// D543 - DOUBLE COUNTERS: `Double the number of +1/+1 counters on <target | ~ | it | each creature you control>.` and
// `Double the number of each kind of counter on <...>.` - the count read off each object as the clause runs (after the
// clauses before it), that many more put. What is proven here: the reading (the referent after a counter put, a scope,
// every kind, the self) and the spells complete; Growth Curve putting one counter on a creature with two, then doubling
// the three to six; the executor over a scope (each creature you control, an opponent's left alone) and over every kind
// (the +1/+1 counters and the shield counter both doubled); the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { effectResult } from './effects';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { EventBody } from './types/events';

const LANDS = ['Forest', 'Forest', 'Forest', 'Forest', 'Island', 'Island', 'Island', 'Island'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const counters = (g: Game, id: InstanceId, kind = '+1/+1') => g.state.cards[id]?.counters[kind] ?? 0;
const setCounters = (g: Game, id: InstanceId, kind: string, n: number) => must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: id, kind, delta: n }));
const changesOf = (events: readonly EventBody[]) => events.flatMap((e) => (e.t === 'CountersChanged' ? e.changes : []));

/** p1 casts Growth Curve at `target` ({G}{U}), leaving it on the stack for a direct executor call. */
function castGrowthCurve(g: Game, curve: InstanceId, target: InstanceId) {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: curve, targets: [{ kind: 'card', id: target }] }));
}

describe('D543 - double counters', () => {
  test('the reading: the referent after a put, a scope, every kind, the self; the spells complete', () => {
    const curve = parseEffects('Put a +1/+1 counter on target creature you control, then double the number of +1/+1 counters on that creature.', 'Growth Curve', true);
    expect(curve.mode).toBe('auto');
    expect(curve.effects.map((e) => e.kind)).toEqual(['putCounters', 'doubleCounters']);
    const scope = parseEffects('Double the number of +1/+1 counters on each creature you control.', '~', true);
    expect(scope.mode).toBe('auto');
    expect(scope.effects[0]?.kind).toBe('doubleCounters');
    expect(scope.effects[0]?.scopes?.length).toBe(1);
    const every = parseEffects('Double the number of each kind of counter on target permanent.', '~', true);
    expect(every.mode).toBe('auto');
    expect(every.effects[0]?.everyKind).toBe(true);
    const self = parseEffects('Double the number of +1/+1 counters on this creature.', 'Dragonsguard Elite', true);
    expect(self.effects[0]?.self).toBe(true);
    for (const name of ['Growth Curve', 'Invigorating Surge']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('Growth Curve: one counter put on a creature with two, then the three doubled to six', () => {
    const g = startedGame({ players: 2, decks: [['Growth Curve', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const curve = put(g, 'p1', 'Growth Curve', 'hand');
    main3(g);
    setCounters(g, bears, '+1/+1', 2);
    castGrowthCurve(g, curve, bears);
    settle(g);
    expect(counters(g, bears)).toBe(6);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the executor: a scope doubles each creature you control; every kind doubles each kind the target carries', () => {
    const g = startedGame({ players: 2, decks: [['Growth Curve', 'Grizzly Bears', 'Grizzly Bears', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const one = put(g, 'p1', 'Grizzly Bears');
    const two = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    const curve = put(g, 'p1', 'Growth Curve', 'hand');
    main3(g);
    setCounters(g, one, '+1/+1', 1);
    setCounters(g, two, '+1/+1', 3);
    setCounters(g, theirs, '+1/+1', 2);
    setCounters(g, one, 'shield', 1);
    castGrowthCurve(g, curve, one);
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.awaiting === null, 20_000);
    const obj = g.state.stack[0];
    if (!obj) throw new Error('no stack object');
    const scoped = changesOf(effectResult(g.state, g.deps, obj, parseEffects('Double the number of +1/+1 counters on each creature you control.', '~', true).effects).events);
    expect(scoped).toEqual(expect.arrayContaining([{ card: one, kind: '+1/+1', delta: 1 }, { card: two, kind: '+1/+1', delta: 3 }]));
    expect(scoped.some((c) => c.card === theirs), "an opponent's creature is left alone").toBe(false);
    const every = changesOf(effectResult(g.state, g.deps, obj, parseEffects('Double the number of each kind of counter on target creature you control.', '~', true).effects).events);
    expect(every).toEqual(expect.arrayContaining([{ card: one, kind: '+1/+1', delta: 1 }, { card: one, kind: 'shield', delta: 1 }]));
    expect(every).toHaveLength(2);
  });
});

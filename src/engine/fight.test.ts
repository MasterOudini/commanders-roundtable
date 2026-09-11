// D396 - BITE and FIGHT (CR 701.12): two operands, one DamageDealt. "<subject> deals damage equal to
// its power to <target>." is the one-way half; "<subject> fights <target>." deals both ways at once.
// The subject is a target, the self, or the referent (D392); the object is the clause's OTHER
// target, a second index the parser hands out after the subject's. Either operand gone, or not a
// creature at resolution, means no damage at all (CR 701.12b/c). Every keyword the damage helper
// knows (deathtouch, lifelink, infect, wither) rides along as it does for every damage event.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

describe('the bite and fight vocabulary (D396)', () => {
  test('a two-target fight, a referent bite after a pump and a referent fight after a counter read with two indices', () => {
    const blood = parseEffects("Target creature you control fights target creature you don't control.", 'Go for Blood', true);
    expect(blood.mode).toBe('auto');
    expect(blood.effects.map((e) => [e.kind, e.targetIndex, e.otherTargetIndex])).toEqual([['fight', 0, 1]]);
    expect(parseTargetClauses("Target creature you control fights target creature you don't control.")).toHaveLength(2);
    const way = parseEffects("Target creature you control gains vigilance and trample until end of turn. It deals damage equal to its power to target creature you don't control.", "Nature's Way", true);
    expect(way.mode).toBe('auto');
    expect(way.effects.map((e) => [e.kind, e.targetIndex, e.otherTargetIndex ?? null, e.referent ?? false])).toEqual([
      ['pump', 0, null, false],
      ['bite', 0, 1, true],
    ]);
    const hunt = parseEffects("Put a +1/+1 counter on target creature you control. Then that creature fights target creature you don't control.", 'Hunt the Weak', true);
    expect(hunt.mode).toBe('auto');
    expect(hunt.effects.map((e) => [e.kind, e.targetIndex, e.otherTargetIndex ?? null])).toEqual([['putCounters', 0, null], ['fight', 0, 1]]);
  });

  test('the self forms read with one index, and the opponent-chooses form stays unread', () => {
    const self = parseEffects("This creature fights up to one target creature you don't control.", '~', true);
    expect(self.mode).toBe('auto');
    expect(self.effects.map((e) => [e.kind, e.targetIndex, e.otherTargetIndex, e.self])).toEqual([['fight', -1, 0, true]]);
    const spike = parseEffects('This creature deals damage equal to its power to any target.', '~', true);
    expect(spike.mode).toBe('auto');
    expect(spike.effects.map((e) => [e.kind, e.targetIndex, e.otherTargetIndex])).toEqual([['bite', -1, 0]]);
    expect(parseEffects("Tap target creature you control and target creature of an opponent's choice they control. Those creatures fight each other.", 'Arena', true).mode).not.toBe('auto');
  });
});

describe('bite and fight in play (D396)', () => {
  test('Go for Blood: both creatures deal their power at once, the lethal one dies, and the game replays', () => {
    const g = startedGame({ players: 2, decks: [['Go for Blood', 'Colossal Dreadmaw'], ['Grizzly Bears']] });
    const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw');
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const blood = put(g, 'p1', 'Go for Blood', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: blood, targets: [{ kind: 'card', id: dreadmaw }, { kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'the Bears took 6 and died').toBe('graveyard');
    expect(g.state.cards[dreadmaw]?.damage, 'the Dreadmaw took the Bears’ 2').toBe(2);
    const fought = g.log.filter((e) => e.body.t === 'Fought');
    expect(fought).toHaveLength(1);
    expect(fought[0]?.body.t === 'Fought' && fought[0].body.mutual).toBe(true);
    const dealt = g.log.filter((e) => e.body.t === 'DamageDealt');
    expect(dealt).toHaveLength(1);
    expect(dealt[0]?.body.t === 'DamageDealt' ? dealt[0].body.damages.length : 0, 'ONE event, two entries').toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Nature's Way: the pumped creature bites one way through the referent and takes nothing back", () => {
    const g = startedGame({ players: 2, decks: [["Nature's Way", 'Grizzly Bears'], ['Colossal Dreadmaw']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    settle(g);
    const way = put(g, 'p1', "Nature's Way", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: way, targets: [{ kind: 'card', id: bears }, { kind: 'card', id: dreadmaw }] }));
    settle(g);
    expect(g.state.cards[dreadmaw]?.damage, 'the Dreadmaw took the Bears’ 2').toBe(2);
    expect(g.state.cards[bears]?.damage, 'a bite is one way').toBe(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    const fought = g.log.filter((e) => e.body.t === 'Fought');
    expect(fought[0]?.body.t === 'Fought' && fought[0].body.mutual).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Hunt the Weak: the counter lands first, then the same creature fights through the referent', () => {
    const g = startedGame({ players: 2, decks: [['Hunt the Weak', 'Grizzly Bears'], ['Grizzly Bears']] });
    const mine = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const hunt = put(g, 'p1', 'Hunt the Weak', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: hunt, targets: [{ kind: 'card', id: mine }, { kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[mine]?.counters['+1/+1'], 'the counter landed first').toBe(1);
    expect(g.state.cards[theirs]?.zone.kind, 'a 3/3 kills a 2/2').toBe('graveyard');
    expect(g.state.cards[mine]?.damage, 'and takes 2 back').toBe(2);
    expect(g.state.cards[mine]?.zone.kind, 'which a 3/3 survives').toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

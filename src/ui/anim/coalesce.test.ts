import { describe, expect, it } from 'vitest';
import { coalesce, coalesceWithControllers, type BeatIntent } from './coalesce';
import { GOVERNOR, effectiveMode, governorFor } from './governor';
import type { EngineEvent } from '../../view/types';

const S = 1; // one step id — everything below is ONE group

function only<K extends BeatIntent['kind']>(
  intents: BeatIntent[],
  kind: K,
): Extract<BeatIntent, { kind: K }>[] {
  return intents.filter((i) => i.kind === kind) as Extract<BeatIntent, { kind: K }>[];
}

describe('coalesce — draws', () => {
  it('turns n draws by one player into ONE staggered beat', () => {
    const events: EngineEvent[] = Array.from({ length: 6 }, (_, i) => ({
      t: 'CardDrawn' as const,
      stepId: S,
      player: 'p1',
      instanceId: `c${i}`,
    }));
    const draws = only(coalesce(events), 'draw');
    expect(draws).toHaveLength(1);
    expect(draws[0]!.instanceIds).toHaveLength(6);
  });

  it('keeps different players’ draws apart', () => {
    const events: EngineEvent[] = [
      { t: 'CardDrawn', stepId: S, player: 'p1', instanceId: 'a' },
      { t: 'CardDrawn', stepId: S, player: 'p2', instanceId: 'b' },
      { t: 'CardDrawn', stepId: S, player: 'p1', instanceId: 'c' },
    ];
    const draws = only(coalesce(events), 'draw');
    expect(draws).toHaveLength(2);
    expect(draws.find((d) => d.player === 'p1')!.instanceIds).toEqual(['a', 'c']);
  });
});

describe('coalesce — taps', () => {
  it('collapses a row of taps into one sweep', () => {
    const events: EngineEvent[] = ['a', 'b', 'c', 'd'].map((id) => ({
      t: 'PermanentTapped' as const,
      stepId: S,
      instanceId: id,
    }));
    const sweeps = only(coalesce(events), 'tapSweep');
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]!.instanceIds).toHaveLength(4);
    expect(sweeps[0]!.untap).toBe(false);
  });

  it('keeps taps and untaps as separate sweeps', () => {
    const events: EngineEvent[] = [
      { t: 'PermanentTapped', stepId: S, instanceId: 'a' },
      { t: 'PermanentUntapped', stepId: S, instanceId: 'b' },
    ];
    const sweeps = only(coalesce(events), 'tapSweep');
    expect(sweeps).toHaveLength(2);
    expect(sweeps.map((s) => s.untap).sort()).toEqual([false, true]);
  });

  it('splits one sweep across the real controllers', () => {
    // ⚠️ Tap events do not carry a controller. Without re-splitting, a mass untap
    // across two pods becomes ONE sweep, and the row-flash gradient would be drawn
    // across a band that never untapped.
    const events: EngineEvent[] = ['a', 'b', 'c'].map((id) => ({
      t: 'PermanentUntapped' as const,
      stepId: S,
      instanceId: id,
    }));
    const owner: Record<string, string> = { a: 'p1', b: 'p2', c: 'p1' };
    const sweeps = only(coalesceWithControllers(events, (id) => owner[id]), 'tapSweep');
    expect(sweeps).toHaveLength(2);
    expect(sweeps.find((s) => s.player === 'p1')!.instanceIds).toEqual(['a', 'c']);
    expect(sweeps.find((s) => s.player === 'p2')!.instanceIds).toEqual(['b']);
  });
});

describe('coalesce — life', () => {
  it('keeps only the FINAL value, so the counter retargets instead of stuttering', () => {
    const events: EngineEvent[] = [
      { t: 'LifeChanged', stepId: S, player: 'p1', from: 40, to: 33 },
      { t: 'LifeChanged', stepId: S, player: 'p1', from: 33, to: 31 },
      { t: 'LifeChanged', stepId: S, player: 'p1', from: 31, to: 45 },
    ];
    const life = only(coalesce(events), 'life');
    expect(life).toHaveLength(1);
    expect(life[0]!.to).toBe(45);
  });

  it('tracks each player separately', () => {
    const events: EngineEvent[] = [
      { t: 'LifeChanged', stepId: S, player: 'p1', from: 40, to: 33 },
      { t: 'LifeChanged', stepId: S, player: 'p2', from: 40, to: 36 },
    ];
    expect(only(coalesce(events), 'life')).toHaveLength(2);
  });
});

describe('coalesce — damage', () => {
  it('sums damage to one target into ONE punch', () => {
    const events: EngineEvent[] = [
      { t: 'DamageDealt', stepId: S, target: 'c1', targetKind: 'card', amount: 2, commander: false, source: null },
      { t: 'DamageDealt', stepId: S, target: 'c1', targetKind: 'card', amount: 3, commander: false, source: null },
    ];
    const dmg = only(coalesce(events), 'damage');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]!.amount).toBe(5);
  });

  it('keeps separate targets separate — combat damage IS simultaneous', () => {
    const events: EngineEvent[] = [
      { t: 'DamageDealt', stepId: S, target: 'p2', targetKind: 'player', amount: 3, commander: false, source: 'a' },
      { t: 'DamageDealt', stepId: S, target: 'p3', targetKind: 'player', amount: 4, commander: false, source: 'b' },
    ];
    expect(only(coalesce(events), 'damage')).toHaveLength(2);
  });

  it('keeps the commander flag if ANY hit was commander damage', () => {
    const events: EngineEvent[] = [
      { t: 'DamageDealt', stepId: S, target: 'p2', targetKind: 'player', amount: 3, commander: false, source: 'a' },
      { t: 'DamageDealt', stepId: S, target: 'p2', targetKind: 'player', amount: 7, commander: true, source: 'cmd' },
    ];
    const dmg = only(coalesce(events), 'damage');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]!.amount).toBe(10);
    expect(dmg[0]!.commander).toBe(true);
  });
});

describe('coalesce — the multi-hop rule', () => {
  it('flies ONLY the last hop for a card that moves twice in one group', () => {
    // Cast → countered → graveyard. Without this rule you watch the card fly to a
    // stack you already know it never stayed on, then fly off it again.
    const events: EngineEvent[] = [
      { t: 'SpellCast', stepId: S, instanceId: 'x', from: 'hand:p1', controller: 'p1', stackItemId: 'st1' },
      { t: 'StackResolved', stepId: S, stackItemId: 'st1', instanceId: 'x', to: 'gy:p1', targets: [], controller: 'p1' },
    ];
    const flights = only(coalesce(events), 'flight');
    expect(flights).toHaveLength(1);
    // From the FIRST source to the LAST destination.
    expect(flights[0]!.from).toBe('hand:p1');
    expect(flights[0]!.to).toBe('gy:p1');
    // And it is no longer "a cast" — the card never stayed on the stack.
    expect(flights[0]!.as).toBe('move');
  });

  it('collapses three hops the same way', () => {
    const events: EngineEvent[] = [
      { t: 'CardMoved', stepId: S, instanceId: 'x', from: 'hand:p1', to: 'bf:p1', faceUpAtEnd: true },
      { t: 'CardMoved', stepId: S, instanceId: 'x', from: 'bf:p1', to: 'gy:p1', faceUpAtEnd: true },
      { t: 'CardMoved', stepId: S, instanceId: 'x', from: 'gy:p1', to: 'exile:p1', faceUpAtEnd: true },
    ];
    const flights = only(coalesce(events), 'flight');
    expect(flights).toHaveLength(1);
    expect(flights[0]!.from).toBe('hand:p1');
    expect(flights[0]!.to).toBe('exile:p1');
  });

  it('leaves a SINGLE hop as its specific named beat', () => {
    const cast = only(
      coalesce([
        { t: 'SpellCast', stepId: S, instanceId: 'x', from: 'hand:p1', controller: 'p1', stackItemId: 'st1' },
      ]),
      'flight',
    );
    expect(cast[0]!.as).toBe('cast');

    const resolve = only(
      coalesce([{ t: 'StackResolved', stepId: S, stackItemId: 'st1', instanceId: 'x', to: 'bf:p1', targets: [], controller: 'p1' }]),
      'flight',
    );
    expect(resolve[0]!.as).toBe('resolve');

    const land = only(
      coalesce([
        { t: 'CardMoved', stepId: S, instanceId: 'l', from: 'hand:p1', to: 'bf:p1', faceUpAtEnd: true },
      ]),
      'flight',
    );
    expect(land[0]!.as).toBe('land');
  });

  it('does not merge hops belonging to DIFFERENT cards', () => {
    const events: EngineEvent[] = [
      { t: 'CardMoved', stepId: S, instanceId: 'a', from: 'hand:p1', to: 'gy:p1', faceUpAtEnd: true },
      { t: 'CardMoved', stepId: S, instanceId: 'b', from: 'hand:p1', to: 'gy:p1', faceUpAtEnd: true },
    ];
    expect(only(coalesce(events), 'flight')).toHaveLength(2);
  });
});

describe('coalesce — HUD-only events never produce a beat', () => {
  it('drops priority, log and loss events', () => {
    // ⚠️ These must NEVER be queued. Whose priority it is, and what the log says,
    // can never be allowed to lag behind the animation queue — that is what keeps
    // input responsive during a burst.
    const events: EngineEvent[] = [
      { t: 'PriorityChanged', stepId: S, player: 'p2' },
      { t: 'Logged', stepId: S, entry: { id: 1, text: 'x', player: null, identity: [], manual: false } },
      { t: 'PlayerLost', stepId: S, player: 'p3', reason: '0 life' },
    ];
    expect(coalesce(events)).toEqual([]);
  });
});

describe('coalesce — grouping does not lose events', () => {
  it('produces an intent for every visible thing in a busy group', () => {
    const events: EngineEvent[] = [
      { t: 'CardDrawn', stepId: S, player: 'p1', instanceId: 'd1' },
      { t: 'PermanentTapped', stepId: S, instanceId: 't1' },
      { t: 'DamageDealt', stepId: S, target: 'p2', targetKind: 'player', amount: 3, commander: false, source: 't1' },
      { t: 'LifeChanged', stepId: S, player: 'p2', from: 40, to: 37 },
      { t: 'PermanentDied', stepId: S, instanceId: 'x1' },
      { t: 'TokenCreated', stepId: S, instanceId: 'k1' },
      { t: 'CardRevealed', stepId: S, instanceId: 'r1' },
      { t: 'PhaseChanged', stepId: S, phase: 'main2', turnNumber: 1, active: 'p1' },
    ];
    const kinds = coalesce(events).map((i) => i.kind).sort();
    expect(kinds).toEqual(
      ['damage', 'death', 'draw', 'life', 'phase', 'reveal', 'tapSweep', 'token'].sort(),
    );
  });

  it('is empty for an empty group', () => {
    expect(coalesce([])).toEqual([]);
  });
});

describe('governorFor', () => {
  it('runs at full speed for a small queue', () => {
    expect(governorFor(0, 0).rate).toBe(1);
    expect(governorFor(600, 1).rate).toBe(1);
    expect(governorFor(600, 1).drain).toBe(false);
  });

  it('ramps smoothly between 600 ms and 1800 ms', () => {
    const mid = governorFor(1200, 3);
    expect(mid.rate).toBeGreaterThan(1);
    expect(mid.rate).toBeLessThan(GOVERNOR.rampTopRate);
    // Monotone across the ramp.
    let prev = 0;
    for (const ms of [700, 900, 1100, 1400, 1700]) {
      const r = governorFor(ms, 3).rate;
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
    expect(governorFor(1800, 3).rate).toBeCloseTo(GOVERNOR.rampTopRate, 6);
  });

  it('goes to the maximum rate and coalesces hard past 1800 ms', () => {
    const hard = governorFor(2500, 6);
    expect(hard.rate).toBe(GOVERNOR.maxRate);
    expect(hard.coalesceHard).toBe(true);
    expect(hard.drain).toBe(false);
  });

  it('drains past 4000 ms', () => {
    expect(governorFor(4001, 5).drain).toBe(true);
  });

  it('drains on group COUNT even when the queue is short', () => {
    // 30 phase changes are 200 ms each but 30 separate groups; the player would sit
    // through 30 sequential beats for something they do not need to watch.
    expect(governorFor(300, 25).drain).toBe(true);
    expect(governorFor(300, 24).drain).toBe(false);
  });
});

describe('effectiveMode', () => {
  const base = { reducedMotion: false, speedOff: false, tableVisible: true, drain: false };

  it('is full only when nothing objects', () => {
    expect(effectiveMode(base)).toBe('full');
  });

  it('routes all four triggers to the SAME digest mode', () => {
    // One implementation, four triggers — see the note in governor.ts.
    expect(effectiveMode({ ...base, reducedMotion: true })).toBe('digest');
    expect(effectiveMode({ ...base, speedOff: true })).toBe('digest');
    expect(effectiveMode({ ...base, tableVisible: false })).toBe('digest');
    expect(effectiveMode({ ...base, drain: true })).toBe('digest');
  });
});

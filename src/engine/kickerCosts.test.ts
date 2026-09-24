// D530 - THE KICKER'S OTHER COSTS (CR 702.33). `Kicker {A} and/or {B}`: two kicker costs, the cast naming which it pays
// (`kickedWith`), the permanent remembering both the count and which; `Kicker—<cost>.`: a kicker that is not only mana,
// its verb charged as D406's additional cost when the cast is kicked. What is proven here: the parse of both forms (and
// of a mana piece beside the verb, and a life payment); a verb-kicked Final Flourish (the fodder sacrificed, the instead
// clause's -6/-6), the same spell unkicked (-2/-2, nothing sacrificed), a kick without its picks refused; Thornscape
// Battlemage kicked with its SECOND kicker (only {W} charged, `kickedWith: [1]` on the permanent), kicked twice (both
// charged), a named kicker on a one-kicker face and a third kick refused; the replay hash on each game.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { derive } from './derive';
import type { Game } from './game';

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const pool = (g: Game) => { const p = g.state.players.p1?.pool; return p ? p.W + p.U + p.B + p.R + p.G + p.C : -1; };

function game(): Game {
  const forests = (n: number) => Array.from({ length: n }, () => 'Forest');
  const g = startedGame({
    players: 2,
    decks: [['Final Flourish', 'Thornscape Battlemage', 'Grizzly Bears', ...forests(12)], ['Cyclops of One-Eyed Pass', ...forests(10)]],
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  return g;
}

describe('D530 - the kicker forms D403 left out', () => {
  test('the parse: two kicker costs, a verb kicker, a mana piece beside the verb, a life payment', () => {
    const tb = faceNamed('Thornscape Battlemage');
    expect(tb.kickerCost?.raw).toBe('{R}');
    expect(tb.kickerCost2?.raw).toBe('{W}');
    expect(tb.kickerVerb).toBeNull();
    const ff = faceNamed('Final Flourish');
    expect(ff.kickerCost).toBeNull();
    expect(ff.kickerVerb?.sacrificeCost?.count).toBe(1);
    expect(ff.kickerVerb?.mana).toBeNull();
    expect(ff.effectMode).toBe('auto');
    const dl = faceNamed('Dwarven Landslide');
    expect(dl.kickerVerb?.mana?.raw).toBe('{2}{R}');
    expect(dl.kickerVerb?.sacrificeCost?.count).toBe(1);
    const ps = faceNamed('Phyrexian Scuta');
    expect(ps.kickerVerb?.lifeCost).toBe(3);
  });

  test('Final Flourish kicked by a sacrifice: the fodder goes, the instead clause gives -6/-6', () => {
    const g = game();
    const flourish = put(g, 'p1', 'Final Flourish', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    main(g, 3);
    mana(g, 'CB');
    // A kick without its picks is refused by name.
    const bare = g.submit({ t: 'CastSpell', player: 'p1', card: flourish, kicked: 1, targets: [{ kind: 'card', id: cyclops }] });
    expect(bare.ok).toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flourish, kicked: 1, sacrifice: [bears], targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'the kicker sacrificed the Bears').toBe('graveyard');
    expect(g.state.cards[cyclops]?.zone.kind, 'a 3/2 under -6/-6 dies').toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCast' && (e.body.obj.kicked ?? 0) === 1)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Final Flourish unkicked: -2/-2 and nothing sacrificed; picks without the kick refused', () => {
    const g = game();
    const flourish = put(g, 'p1', 'Final Flourish', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    main(g, 3);
    mana(g, 'CB');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: flourish, sacrifice: [bears], targets: [{ kind: 'card', id: cyclops }] }).ok, 'picks with no kick and no additional cost').toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flourish, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'a 2/2 under -2/-2 dies').toBe('graveyard');
    expect(g.state.cards[cyclops]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Thornscape Battlemage kicked with its second kicker: only {W} charged, the permanent remembers which', () => {
    const g = game();
    const mage = put(g, 'p1', 'Thornscape Battlemage', 'hand');
    main(g, 3);
    mana(g, 'CCGW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mage, kicked: 1, kickedWith: [1] }));
    settle(g);
    expect(g.state.cards[mage]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mage]?.kicked).toBe(1);
    expect(g.state.cards[mage]?.kickedWith).toEqual([1]);
    expect(pool(g), 'the {R} kicker was not charged, {2}{G} + {W} was').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('kicked twice pays both; a named kicker on a one-kicker face and a third kick are refused', () => {
    const g = game();
    const mage = put(g, 'p1', 'Thornscape Battlemage', 'hand');
    const flourish = put(g, 'p1', 'Final Flourish', 'hand');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    main(g, 3);
    mana(g, 'CCGRW');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: mage, kicked: 3 }).ok, 'two kickers, three kicks').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: mage, kicked: 1, kickedWith: [0, 1] }).ok, 'one kick, two named').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: flourish, kicked: 1, kickedWith: [0], targets: [{ kind: 'card', id: cyclops }] }).ok, 'a one-kicker face names no kicker').toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mage, kicked: 2 }));
    settle(g);
    expect(g.state.cards[mage]?.kicked).toBe(2);
    expect(g.state.cards[mage]?.kickedWith).toEqual([0, 1]);
    expect(pool(g), '{2}{G} + {R} + {W}').toBe(0);
    const d = derive(g.state, deps().oracle, deps().scripts, mage);
    expect(d.power).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

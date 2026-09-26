// D556 - REPLICATE (CR 702.56a): "As an additional cost to cast this spell, you may pay [cost] any number of times" and
// "When you cast this spell, if a replicate cost was paid for it, copy it for each time its replicate cost was paid. If
// the spell has any targets, you may choose new targets for any of the copies." The count rides the cast
// (`CastSpell.replicated` - multikicker's shape, priced at every stage, remembered by the stack object) and a keyword
// trigger off the spell on the stack makes the copies (storm's shape and copy spec, D536). What is proven here: the
// readings (the Replicate line leaves the spell's clauses; the eight complete); Train of Thought replicated twice draws
// three; a replicated Pyromatics' copy aimed anew, and a cast that pays none fires no trigger; the offer names the cost
// and whether one payment is affordable, and a count on a face with no replicate cost is refused; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { TargetChoice } from './types/state';

const LANDS = ['Island', 'Island', 'Island', 'Island', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const REPLICATE = ['Super Combo', 'Vacuumelt', 'Shattering Spree', 'Pyromatics', 'Gigadrowse', 'Lose Focus', 'Train of Thought', 'Leap of Flame'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, sym: 'U' | 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const hand = (g: Game) => (g.state.zones.hand.p1 ?? []).length;
const P2: TargetChoice = { kind: 'player', id: 'p2' };
const P1: TargetChoice = { kind: 'player', id: 'p1' };
/** Resolves the stack, answering every copy's new-targets question with `pick(i)` (empty keeps the original's); how many were asked. */
function resolveAll(g: Game, pick: (i: number) => readonly TargetChoice[] = () => []): number {
  let asked = 0;
  for (;;) {
    advanceUntil(g, (s) => (s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy') || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'chooseTargets' || a.forKind !== 'copy') return asked;
    must(g.submit({ t: 'ChooseTargets', player: a.player, targets: pick(asked) }));
    asked += 1;
  }
}
const replicateTrigger = (g: Game, from: number) => g.log.slice(from).find((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:replicate'));
const copies = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'SpellCopied').length;

describe('D556 - replicate', () => {
  test('the readings: the Replicate cost on the face, the line out of the clauses, the eight complete', () => {
    expect(faceNamed('Pyromatics').replicateCost?.raw).toBe('{1}{R}');
    expect(faceNamed('Pyromatics').keywords).toContain('replicate');
    expect(faceNamed('Pyromatics').effectMode).toBe('auto');
    expect(faceNamed('Train of Thought').replicateCost?.raw).toBe('{1}{U}');
    expect(faceNamed('Lightning Bolt').replicateCost).toBeNull();
    for (const name of REPLICATE) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('Train of Thought replicated twice: two copies off the trigger, three cards drawn', () => {
    const g = startedGame({ players: 2, decks: [['Train of Thought', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const train = put(g, 'p1', 'Train of Thought', 'hand');
    main3(g);
    mana(g, 'U', 3);
    mana(g, 'C', 3);
    const hand0 = hand(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: train, replicated: 2 }));
    expect(resolveAll(g), 'no targets, no question').toBe(0);
    const cast = g.log.slice(n0).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.replicated : null, 'the stack object remembers the count').toBe(2);
    const trig = replicateTrigger(g, n0);
    expect(trig?.body.t === 'AbilityPutOnStack' ? trig.body.obj.memo : null, 'the trigger took the count').toBe(2);
    expect(copies(g, n0)).toBe(2);
    expect(hand(g), 'the spell left the hand; it and its two copies drew').toBe(hand0 - 1 + 3);
    expect(g.state.cards[train]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a replicated Pyromatics: its copy aimed anew; a cast that pays none fires no trigger', () => {
    const g = startedGame({ players: 2, decks: [['Pyromatics', 'Pyromatics', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const first = put(g, 'p1', 'Pyromatics', 'hand');
    const second = put(g, 'p1', 'Pyromatics', 'hand');
    main3(g);
    const [p1Life, p2Life] = [life(g, 'p1'), life(g, 'p2')];
    mana(g, 'R', 2);
    mana(g, 'C', 2);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first, targets: [P2], replicated: 1 }));
    expect(resolveAll(g, () => [P1]), 'the one copy asked').toBe(1);
    expect(copies(g, n0)).toBe(1);
    expect(life(g, 'p1'), 'the copy was aimed at its own controller').toBe(p1Life - 1);
    expect(life(g, 'p2'), 'Pyromatics itself').toBe(p2Life - 1);
    mana(g, 'R', 1);
    mana(g, 'C', 1);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second, targets: [P2] }));
    expect(resolveAll(g)).toBe(0);
    expect(replicateTrigger(g, n1), 'no replicate paid, no trigger').toBeUndefined();
    expect(copies(g, n1)).toBe(0);
    expect(life(g, 'p2')).toBe(p2Life - 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the offer names the cost and whether one payment is affordable; a count on a face without replicate is refused', () => {
    const g = startedGame({ players: 2, decks: [['Pyromatics', 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const pyro = put(g, 'p1', 'Pyromatics', 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    main3(g);
    mana(g, 'R', 2);
    const offer = () => legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === pyro);
    const o1 = offer();
    expect(o1?.t === 'CastSpell' ? [o1.affordable, o1.replicateCost, o1.replicateAffordable] : null, 'the base cast only').toEqual([true, '{1}{R}', false]);
    mana(g, 'C', 2);
    const o2 = offer();
    expect(o2?.t === 'CastSpell' ? o2.replicateAffordable : null, 'one payment beside the base').toBe(true);
    const plain = legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === bolt);
    expect(plain?.t === 'CastSpell' ? plain.replicateCost : 'no offer', 'no replicate on the Bolt').toBeUndefined();
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [P2], replicated: 1 }).ok, 'Lightning Bolt has no replicate').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

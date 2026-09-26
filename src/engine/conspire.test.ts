// D557 - CONSPIRE (CR 702.78a): "As you cast this spell, you may tap two untapped creatures you control that share a
// color with it. When you do, copy it and you may choose a new target for the copy." The tap rides D530's verb-kicker
// path (`OracleFace.conspireVerb` - D406's tap chooser, one creature predicate per printed colour), announced by
// `CastSpell.conspired` with its `tap` picks; the stack object remembers it and a cast trigger makes the copy (storm's
// copy spec, D536 - replicate's shape, D556). What is proven here: the readings (the Conspire line leaves the spell's
// clauses; the seven complete); a conspired Burn Trail taps two red creatures and its copy is aimed anew; the offer lists
// the untapped creatures that share a colour; a hybrid Barkshell Blessing takes a white and a green creature; a creature
// that shares no colour is refused, and so is one creature alone; a cast that does not conspire fires no trigger; the
// replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { TargetChoice } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Forest', 'Forest', 'Forest', 'Forest'];
const CONSPIRE = ['Rally the Galadhrim', 'Memory Sluice', 'Aethertow', 'Gleeful Sabotage', 'Burn Trail', 'Ghastly Discovery', 'Barkshell Blessing'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, sym: 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const power = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id).power ?? 0;
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
const conspireTrigger = (g: Game, from: number) => g.log.slice(from).find((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:conspire'));
const copies = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'SpellCopied').length;
const offerOf = (g: Game, card: InstanceId) => legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);

describe('D557 - conspire', () => {
  test('the readings: the Conspire verb on the face (two creatures, a predicate per colour), the line out of the clauses, the seven complete', () => {
    for (const name of CONSPIRE) {
      const face = faceNamed(name);
      expect(face.conspireVerb?.tapCost?.count, name).toBe(2);
      expect(face.keywords, name).toContain('conspire');
      expect(face.effectMode, name).toBe('auto');
      expect(isEngineComplete(fixture(name)), name).toBe(true);
    }
    expect(faceNamed('Barkshell Blessing').conspireVerb?.tapCost?.any.map((p) => p.colors.join('')).sort()).toEqual(['G', 'W']);
    expect(faceNamed('Lightning Bolt').conspireVerb).toBeNull();
  });

  test('a conspired Burn Trail: two red creatures tap, and the copy is aimed anew', () => {
    const g = startedGame({ players: 2, decks: [['Burn Trail', 'Hill Giant', 'Raging Goblin', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const trail = put(g, 'p1', 'Burn Trail', 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    const goblin = put(g, 'p1', 'Raging Goblin');
    put(g, 'p1', 'Grizzly Bears');
    main3(g);
    const [p1Life, p2Life] = [life(g, 'p1'), life(g, 'p2')];
    mana(g, 'R', 1);
    mana(g, 'C', 3);
    const offer = offerOf(g, trail);
    expect(offer?.t === 'CastSpell' ? [...(offer.conspireCandidates ?? [])].sort() : null, 'the red creatures, not the green Bears').toEqual([giant, goblin].sort());
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: trail, targets: [P2], conspired: true, tap: [giant, goblin] }));
    expect(resolveAll(g, () => [P1]), 'the copy asked for a new target').toBe(1);
    const cast = g.log.slice(n0).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.conspired : null).toBe(true);
    expect(conspireTrigger(g, n0)).toBeDefined();
    expect([g.state.cards[giant]?.tapped, g.state.cards[goblin]?.tapped], 'the two creatures paid it').toEqual([true, true]);
    expect(copies(g, n0)).toBe(1);
    expect(life(g, 'p2'), 'Burn Trail itself').toBe(p2Life - 3);
    expect(life(g, 'p1'), 'the copy was aimed at its own controller').toBe(p1Life - 3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a hybrid Barkshell Blessing takes a white and a green creature; no shared colour is refused, and so is one creature', () => {
    const g = startedGame({ players: 2, decks: [['Barkshell Blessing', 'Burn Trail', 'Savannah Lions', 'Grizzly Bears', 'Hill Giant', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const blessing = put(g, 'p1', 'Barkshell Blessing', 'hand');
    const trail = put(g, 'p1', 'Burn Trail', 'hand');
    const lions = put(g, 'p1', 'Savannah Lions');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const giant = put(g, 'p1', 'Hill Giant');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 3);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: trail, targets: [P2], conspired: true, tap: [bears, giant] }).ok, 'the green Bears shares no colour with Burn Trail').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: trail, targets: [P2], conspired: true, tap: [giant] }).ok, 'one creature is not two').toBe(false);
    const [lions0, giant0] = [power(g, lions), power(g, giant)];
    mana(g, 'G', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: blessing, targets: [{ kind: 'card', id: lions }], conspired: true, tap: [lions, bears] }));
    expect(resolveAll(g, () => [{ kind: 'card', id: giant }]), 'the copy asked').toBe(1);
    expect(copies(g, n0)).toBe(1);
    expect([power(g, lions), power(g, giant)], 'the Blessing and its copy').toEqual([lions0 + 2, giant0 + 2]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a cast that does not conspire fires no trigger; a tapped creature is no candidate', () => {
    const g = startedGame({ players: 2, decks: [['Burn Trail', 'Hill Giant', 'Raging Goblin', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const trail = put(g, 'p1', 'Burn Trail', 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    const goblin = put(g, 'p1', 'Raging Goblin');
    main3(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [goblin], tapped: true }));
    const offer = offerOf(g, trail);
    expect(offer?.t === 'CastSpell' ? offer.conspireCandidates : null, 'the tapped Goblin cannot pay it').toEqual([giant]);
    const p2Life = life(g, 'p2');
    mana(g, 'R', 1);
    mana(g, 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: trail, targets: [P2] }));
    expect(resolveAll(g)).toBe(0);
    expect(conspireTrigger(g, n0), 'no conspire, no trigger').toBeUndefined();
    expect(copies(g, n0)).toBe(0);
    expect(g.state.cards[giant]?.tapped).toBe(false);
    expect(life(g, 'p2')).toBe(p2Life - 3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

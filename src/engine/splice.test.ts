// D576 - SPLICE (CR 702.47): "As you cast an Arcane [or: instant or sorcery] spell, you may reveal this card from your hand
// and pay its splice cost. If you do, add this card's effects to that spell." The cards ride the cast (`CastSpell.spliced`
// - checked by the host, priced with the kick, remembered by the stack object as printings), the spell's targets are its
// own and then each spliced card's (castTargetSpecs), and it resolves its own effects and then theirs (withSpliced); the
// spliced cards stay in the hand. What is proven here: the readings (the Splice line leaves the clauses; the proof cards
// complete); the offer (the candidates onto what the spell is, the first one's affordability); Lava Spike with Glacial Ray
// spliced - both halves, the Ray still in the hand; the staged cast asks for every clause's target and charges the splice;
// a spliced target gone by resolution leaves the rest to resolve (CR 608.2b); Everdream onto a Lightning Bolt (instant or
// sorcery); a copy of a spliced spell copies the spliced text (CR 707.10); the refusals; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { poolTotal } from './types/mana';
import type { Game } from './game';
import type { StackId } from './types/ids';
import type { TargetChoice } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Island', 'Island', 'Island', 'Island'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const asked = (g: Game) => { advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000); const a = g.state.priority.awaiting; if (a?.kind !== 'chooseTargets') throw new Error('no targets prompt'); return a; };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'U' | 'R' | 'C', amount: 1 })); };
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? -1;
const handCount = (g: Game) => (g.state.zones.hand.p1 ?? []).length;
const pool = (g: Game) => poolTotal(g.state.players.p1?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
const offer = (g: Game, card: string) => { const a = legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((x) => x.t === 'CastSpell' && x.card === card); return a?.t === 'CastSpell' ? a : undefined; };
const castOf = (g: Game, from: number) => { const e = g.log.slice(from).find((x) => x.body.t === 'SpellCast'); return e?.body.t === 'SpellCast' ? e.body.obj : undefined; };
const said = (g: Game, from: number, re: RegExp) => g.log.slice(from).some((e) => e.body.t === 'Narrated' && re.test(e.body.text));
const P2: TargetChoice = { kind: 'player', id: 'p2' };
const top = (g: Game) => g.state.stack[g.state.stack.length - 1]?.id as StackId;

/**
 * p1's third main phase with Lava Spike and Glacial Ray in hand and p2's Grizzly Bears on the battlefield; the deck's
 * Lightning Bolt wherever it was dealt and its Everdream in exile (out of the hand until a test puts it there).
 */
function spikeAndRay(): { g: Game; spike: string; ray: string; bears: string } {
  const g = startedGame({ players: 2, decks: [['Lava Spike', 'Glacial Ray', 'Lightning Bolt', 'Everdream', ...LANDS], ['Grizzly Bears', ...LANDS]] });
  holdEverywhere(g);
  const spike = put(g, 'p1', 'Lava Spike', 'hand');
  const ray = put(g, 'p1', 'Glacial Ray', 'hand');
  put(g, 'p1', 'Everdream', 'exile');
  const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
  main3(g);
  return { g, spike, ray, bears };
}

describe('D576 - splice', () => {
  test('the readings: the splice on the face, the line out of the clauses, the proof cards complete', () => {
    const ray = faceNamed('Glacial Ray');
    expect([ray.spliceCost?.raw, ray.spliceOnto, ray.effectMode, ray.effects.length, ray.targets.length]).toEqual(['{1}{R}', 'arcane', 'auto', 1, 1]);
    const dream = faceNamed('Everdream');
    expect([dream.spliceCost?.raw, dream.spliceOnto, dream.effectMode, dream.effects.length, dream.targets.length]).toEqual(['{2}{U}', 'instantOrSorcery', 'auto', 1, 0]);
    expect(faceNamed('Lava Spike').spliceCost).toBeNull();
    expect(faceNamed('Lightning Bolt').spliceOnto).toBeNull();
    for (const name of ['Glacial Ray', 'Everdream', 'Lava Spike']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('the offer: the splice cards in hand onto what the spell is, and whether the first one is payable beside it', () => {
    const { g, spike, ray } = spikeAndRay();
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    mana(g, 'R');
    const o1 = offer(g, spike);
    expect([o1?.affordable, o1?.spliceCandidates, o1?.spliceAffordable], 'the Ray onto the Arcane Spike; not payable on {R}').toEqual([true, [ray], false]);
    mana(g, 'RC');
    expect(offer(g, spike)?.spliceAffordable, 'the Spike and the Ray on {R}{R}{C}').toBe(true);
    expect(offer(g, bolt)?.spliceCandidates, 'the Ray splices onto Arcane only - the Bolt is not').toBeUndefined();
    expect(offer(g, ray)?.spliceCandidates, 'the Ray is no candidate for itself').toBeUndefined();
    const dream = put(g, 'p1', 'Everdream', 'hand');
    expect(offer(g, bolt)?.spliceCandidates, 'Everdream onto the instant').toEqual([dream]);
    expect([...(offer(g, spike)?.spliceCandidates ?? [])].sort(), 'both onto the Arcane sorcery').toEqual([ray, dream].sort());
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Lava Spike with Glacial Ray spliced: its own damage, then the Ray' + "'" + 's; the Ray stays in the hand', () => {
    const { g, spike, ray, bears } = spikeAndRay();
    mana(g, 'R');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2, { kind: 'card', id: bears }], spliced: [ray] }).ok, 'the splice cost is charged: {R} pays the Spike alone').toBe(false);
    mana(g, 'RC');
    const p2Life = life(g, 'p2');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2, { kind: 'card', id: bears }], spliced: [ray] }));
    const obj = castOf(g, n0);
    expect(obj?.spliced?.map((s) => s.card), 'the stack object remembers the Ray').toEqual([ray]);
    expect(obj?.spliced?.[0]?.printingId).toBe(g.state.cards[ray]?.printingId);
    expect(pool(g), 'the Spike and the splice paid').toBe(0);
    expect(said(g, n0, /casts Lava Spike, splicing Glacial Ray onto it/), 'the reveal is narrated').toBe(true);
    expect(g.state.cards[ray]?.zone.kind, 'revealed, not moved').toBe('hand');
    settle(g);
    expect(life(g, 'p2'), 'Lava Spike').toBe(p2Life - 3);
    expect(g.state.cards[bears]?.zone.kind, 'the Ray' + "'" + 's 2 damage').toBe('graveyard');
    expect(g.state.cards[ray]?.zone.kind, 'the spliced card stays in the hand').toBe('hand');
    expect(g.state.cards[spike]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the staged cast asks for every clause' + "'" + 's target, the spell' + "'" + 's then the Ray' + "'" + 's, and charges the splice', () => {
    const { g, spike, ray, bears } = spikeAndRay();
    mana(g, 'RRC');
    const p2Life = life(g, 'p2');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spike, spliced: [ray] }));
    const a = asked(g);
    expect(a.specs, 'Lava Spike' + "'" + 's clause and the Ray' + "'" + 's').toHaveLength(2);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [P2, { kind: 'card', id: bears }] }));
    expect(castOf(g, n0)?.spliced?.map((s) => s.card)).toEqual([ray]);
    expect(pool(g)).toBe(0);
    settle(g);
    expect(life(g, 'p2')).toBe(p2Life - 3);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ray]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the Ray' + "'" + 's target gone by resolution: the rest of the spell still resolves (CR 608.2b)', () => {
    const { g, spike, ray, bears } = spikeAndRay();
    mana(g, 'RRC');
    const p2Life = life(g, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2, { kind: 'card', id: bears }], spliced: [ray] }));
    put(g, 'p2', 'Grizzly Bears', 'hand');
    settle(g);
    expect(life(g, 'p2'), 'the Spike' + "'" + 's own clause').toBe(p2Life - 3);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[spike]?.zone.kind, 'resolved, not countered').toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Everdream spliced onto a Lightning Bolt (instant or sorcery): the Bolt, then a card drawn', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Everdream', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const dream = put(g, 'p1', 'Everdream', 'hand');
    main3(g);
    mana(g, 'RUCC');
    const p2Life = life(g, 'p2');
    const h0 = handCount(g);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [P2], spliced: [dream] }));
    expect(pool(g)).toBe(0);
    settle(g);
    expect(life(g, 'p2')).toBe(p2Life - 3);
    expect(handCount(g), 'the Bolt left, Everdream' + "'" + 's draw came').toBe(h0);
    expect(g.state.cards[dream]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a copy of a spliced spell copies the spliced text (CR 707.10): Twincast on a Spike with Everdream draws twice', () => {
    const g = startedGame({ players: 2, decks: [['Lava Spike', 'Everdream', 'Twincast', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spike = put(g, 'p1', 'Lava Spike', 'hand');
    const dream = put(g, 'p1', 'Everdream', 'hand');
    const twin = put(g, 'p1', 'Twincast', 'hand');
    main3(g);
    const p2Life = life(g, 'p2');
    const h0 = handCount(g);
    mana(g, 'RUCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2], spliced: [dream] }));
    const original = top(g);
    mana(g, 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin, targets: [{ kind: 'stack', id: original }] }));
    const a = asked(g);
    expect(a.forKind).toBe('copy');
    const copy = g.state.stack.find((o) => o.id === a.stackId);
    expect(copy?.spliced?.map((s) => s.card), 'the copy carries the spliced card').toEqual([dream]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(life(g, 'p2'), 'the copy and the Spike').toBe(p2Life - 6);
    expect(handCount(g), 'the Spike and Twincast left; the copy and the Spike each drew').toBe(h0);
    expect(g.state.cards[dream]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the refusals: a kind the spell is not, a card with no splice, twice, itself, and a card not in the hand', () => {
    const { g, spike, ray } = spikeAndRay();
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const island = put(g, 'p1', 'Island', 'hand');
    mana(g, 'RRRCCC');
    const why = (r: ReturnType<Game['submit']>) => (r.ok ? 'accepted' : r.message);
    expect(why(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [P2], spliced: [ray] }))).toBe('Glacial Ray splices onto an Arcane spell.');
    expect(why(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2], spliced: [island] }))).toBe('Island has no splice the app can charge.');
    expect(why(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2, { kind: 'player', id: 'p2' }, { kind: 'player', id: 'p2' }], spliced: [ray, ray] }))).toBe('Each card is spliced once.');
    expect(why(g.submit({ t: 'CastSpell', player: 'p1', card: ray, targets: [P2], spliced: [ray] }))).toBe('A spell cannot be spliced onto itself.');
    put(g, 'p1', 'Glacial Ray', 'graveyard');
    expect(why(g.submit({ t: 'CastSpell', player: 'p1', card: spike, targets: [P2], spliced: [ray] }))).toBe('A spliced card is revealed from your hand.');
    expect(g.state.cards[spike]?.zone.kind, 'nothing was cast').toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

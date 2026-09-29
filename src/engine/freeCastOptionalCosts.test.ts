// D491's GRANTED FREE CAST PAYS ITS OPTIONAL COSTS. Casting a spell "without paying its mana cost" is an alternative cost
// (CR 118.9); an additional cost still applies on top of it (CR 118.9d), announced with the cast (CR 601.2b) - so a spell
// cast off cascade, discover, rebound or a from-hand grant may still be kicked, conspire or pay its casualty. The
// `castFree` answer names the card AND its elections (`AnswerChooseFromZone.cast` - the kick, the conspire with its two
// taps, the casualty with its sacrifice, a verb kicker's picks), checked by the same `prepareCast` a `CastSpell` goes
// through. What is proven here: cascade's Burst Lightning kicked - the {4} paid, the kicked spell staged through its
// target, 4 damage; a kick the pool cannot pay refused with the prompt still up, the plain cast after it; Kavu Titan kicked
// and completed at once (it asks nothing) - three counters and trample; a kick named for a spell with no kicker refused,
// and elections on a decline or on a discard prompt; Sram's Expertise's from-hand grant conspired - two green creatures
// tap, the copy aimed anew, and one creature refused; cascade's Light 'Em Up with casualty - a creature under the floor
// refused, the Giant sacrificed only as the staged cast completes, the copy aimed anew; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry, type ScriptRegistry } from './scripts/registryCore';
import { KAVU_TITAN_SCRIPT } from './scripts/cards/kavuTitan';
import { poolTotal } from './types/mana';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import type { TargetChoice } from './types/state';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const onTop = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null && s.pendingCast === null, 20_000);
const grant = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true, 20_000);
const granted = (g: Game) => { const a = g.state.priority.awaiting; return a?.kind === 'chooseFromZone' && a.castFree === true; };
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const castOf = (g: Game, card: InstanceId, from = 0) => g.log.slice(from).map((e) => e.body).find((b): b is Extract<EventBody, { t: 'SpellCast' }> => b.t === 'SpellCast' && b.obj.card === card);
const copies = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'SpellCopied').length;
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const P2: TargetChoice = { kind: 'player', id: 'p2' };
const card = (id: InstanceId): TargetChoice => ({ kind: 'card', id });

/** Resolves the stack, answering every copy's new-targets question with `pick`; how many were asked (conspire.test's walk). */
function resolveAll(g: Game, pick: () => readonly TargetChoice[]): number {
  let asked = 0;
  for (;;) {
    advanceUntil(g, (s) => (s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy') || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'chooseTargets' || a.forKind !== 'copy') return asked;
    must(g.submit({ t: 'ChooseTargets', player: a.player, targets: pick() }));
    asked += 1;
  }
}

/**
 * Bloodbraid Elf cast with `candidate` under a Forest on top of the library, the Elf's {2}{R}{G} and `extra` floating,
 * `mine` and `theirs` on the battlefield: cascade's chooser is up, offering the candidate for free.
 */
function cascaded(candidate: string, extra: string, mine: readonly string[] = [], theirs: readonly string[] = [], scripts?: ScriptRegistry) {
  const g = startedGame({ players: 2, decks: [['Bloodbraid Elf', candidate, 'Forest', ...mine, ...FORESTS], ['Grizzly Bears', ...theirs, ...FORESTS]], options: { maxHandSize: null }, ...(scripts ? { scripts } : {}) });
  holdEverywhere(g);
  const elf = put(g, 'p1', 'Bloodbraid Elf', 'hand');
  const pick = put(g, 'p1', candidate, 'hand');
  const forest = put(g, 'p1', 'Forest', 'hand');
  const ours = mine.map((name) => put(g, 'p1', name));
  const foes = theirs.map((name) => put(g, 'p2', name));
  main(g, 3);
  onTop(g, pick);
  onTop(g, forest);
  mana(g, 'RRGG' + extra);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: elf }));
  grant(g);
  const aw = g.state.priority.awaiting;
  expect(aw?.kind === 'chooseFromZone' ? aw.pool : null, 'cascade offers the candidate').toEqual([pick]);
  return { g, pick, ours, foes };
}

describe("D491 - a granted free cast pays its optional costs (CR 118.9d)", () => {
  test("cascade's Burst Lightning kicked: the {4} paid, the kicked spell staged through its target, 4 damage", () => {
    const { g, pick: burst } = cascaded('Burst Lightning', 'CCCC');
    const p2 = life(g, 'p2');
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [burst], cast: { kicked: 1 } }));
    expect(g.state.priority.awaiting?.kind, 'the kicked cast asks for its target').toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [P2] }));
    settle(g);
    const cast = castOf(g, burst, n0);
    expect(cast?.obj.freeCast, 'cast without paying its mana cost').toBe(true);
    expect(cast?.obj.kicked, 'and kicked').toBe(1);
    expect(poolTotal(g.state.players.p1?.pool ?? { W: 9, U: 0, B: 0, R: 0, G: 0, C: 0 }), 'the kicker took the four left floating').toBe(0);
    expect(life(g, 'p2'), 'kicked: 4, not 2').toBe(p2 - 4);
    hashHolds(g);
  });

  test('a kick the pool cannot pay is refused and the prompt stays up; the plain free cast follows', () => {
    const { g, pick: burst } = cascaded('Burst Lightning', 'CCC');
    const p2 = life(g, 'p2');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [burst], cast: { kicked: 1 } }).ok, 'three floating cannot pay {4}').toBe(false);
    expect(granted(g), 'the chooser is still up').toBe(true);
    expect(zoneOf(g, burst), 'the candidate waits in exile').toBe('exile');
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [burst] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [P2] }));
    settle(g);
    expect(castOf(g, burst, n0)?.obj.kicked, 'unkicked').toBeUndefined();
    expect(life(g, 'p2')).toBe(p2 - 2);
    hashHolds(g);
  });

  test('cascade kicks Kavu Titan, which asks nothing: the cast completes at once, and it enters with three counters and trample', () => {
    const { g, pick: titan } = cascaded('Kavu Titan', 'GGCC', [], [], createRegistry([KAVU_TITAN_SCRIPT]));
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [titan], cast: { kicked: 1 } }));
    expect(castOf(g, titan, n0)?.obj.kicked, 'on the stack, kicked, in the answer batch').toBe(1);
    settle(g);
    expect(zoneOf(g, titan)).toBe('battlefield');
    expect(g.state.cards[titan]?.counters['+1/+1'], 'the kicked entry').toBe(3);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, titan).keywords.has('trample')).toBe(true);
    hashHolds(g);
  });

  test('the same prepareCast refuses: a kick for a spell with no kicker, and elections on a decline or on a discard prompt', () => {
    const { g, pick: bears } = cascaded('Grizzly Bears', '');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears], cast: { kicked: 1 } }).ok, 'the Bears has no kicker').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [], cast: { kicked: 1 } }).ok, 'a decline casts nothing and pays nothing').toBe(false);
    expect(granted(g)).toBe(true);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(zoneOf(g, bears)).toBe('battlefield');
    hashHolds(g);

    // The cleanup discard (D442) is a `chooseFromZone` too - and no cast.
    const d = startedGame({ players: 2, decks: [[...FORESTS, ...FORESTS], [...FORESTS]] });
    must(d.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 9 - (d.state.zones.hand.p1?.length ?? 0) }));
    advanceUntil(d, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = d.state.zones.hand.p1 ?? [];
    const two = [hand[0] as InstanceId, hand[1] as InstanceId];
    expect(d.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: two, cast: { kicked: 1 } }).ok, 'a discard is no cast').toBe(false);
    must(d.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: two }));
    hashHolds(d);
  });

  test("Sram's Expertise grants Gleeful Sabotage from the hand, conspired: two green creatures tap, the copy aimed anew", () => {
    const g = startedGame({ players: 2, decks: [["Sram's Expertise", 'Gleeful Sabotage', 'Grizzly Bears', 'Grizzly Bears', ...FORESTS], ['Mind Stone', 'Mind Stone', ...FORESTS]], options: { maxHandSize: null } });
    holdEverywhere(g);
    const sram = put(g, 'p1', "Sram's Expertise", 'hand');
    const sabotage = put(g, 'p1', 'Gleeful Sabotage', 'hand');
    const bearsA = put(g, 'p1', 'Grizzly Bears');
    const bearsB = put(g, 'p1', 'Grizzly Bears');
    const stoneA = put(g, 'p2', 'Mind Stone');
    const stoneB = put(g, 'p2', 'Mind Stone');
    main(g, 3);
    mana(g, 'WWCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sram }));
    grant(g);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [sabotage], cast: { conspired: true, tap: [bearsA] } }).ok, 'one creature is not two').toBe(false);
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [sabotage], cast: { conspired: true, tap: [bearsA, bearsB] } }));
    expect(g.state.priority.awaiting?.kind, 'the conspired cast asks for its target').toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(stoneA)] }));
    expect(resolveAll(g, () => [card(stoneB)]), 'the copy asked for a new target').toBe(1);
    const cast = castOf(g, sabotage, n0);
    expect([cast?.obj.freeCast, cast?.obj.conspired], 'free, and conspired').toEqual([true, true]);
    expect([g.state.cards[bearsA]?.tapped, g.state.cards[bearsB]?.tapped], 'the two creatures paid it').toEqual([true, true]);
    expect(copies(g, n0)).toBe(1);
    expect([zoneOf(g, stoneA), zoneOf(g, stoneB)], 'the Sabotage and its copy').toEqual(['graveyard', 'graveyard']);
    hashHolds(g);
  });

  test("cascade's Light 'Em Up pays casualty: a creature under the floor refused, the Giant sacrificed as the staged cast completes, the copy aimed anew", () => {
    const { g, pick: light, ours, foes } = cascaded("Light 'Em Up", '', ['Hill Giant', 'Memnite'], ['Savannah Lions']);
    const [giant, mem] = ours as [InstanceId, InstanceId];
    const [lions] = foes as [InstanceId];
    const bears = put(g, 'p2', 'Grizzly Bears');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [light], cast: { casualty: true, sacrifice: [mem] } }).ok, 'a power-1 Memnite is under casualty 2').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [light], cast: { casualty: true } }).ok, 'a casualty naming no creature').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [light], cast: { sacrifice: [giant] } }).ok, 'a sacrifice with no casualty').toBe(false);
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [light], cast: { casualty: true, sacrifice: [giant] } }));
    expect(g.state.priority.awaiting?.kind, 'the cast asks for its target').toBe('chooseTargets');
    expect(zoneOf(g, giant), 'not yet sacrificed - the cost is paid as the cast completes').toBe('battlefield');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(bears)] }));
    const cast = castOf(g, light, n0);
    expect([cast?.obj.freeCast, cast?.obj.casualty], 'free, and its casualty paid').toEqual([true, true]);
    expect(resolveAll(g, () => [card(lions)]), 'the copy asked for a new target').toBe(1);
    expect(copies(g, n0)).toBe(1);
    expect([zoneOf(g, bears), zoneOf(g, lions), zoneOf(g, giant), zoneOf(g, mem)], "the spell's target, the copy's, the casualty, the Memnite").toEqual(['graveyard', 'graveyard', 'graveyard', 'battlefield']);
    hashHolds(g);
  });
});

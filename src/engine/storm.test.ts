// D536 - STORM (CR 702.40a): "When you cast this spell, copy it for each other spell that was cast before it this turn.
// If the spell has any targets, you may choose new targets for any of the copies." A keyword trigger off the spell on
// the stack (D525's cascade shape): the count is taken as the spell is cast, the copies are D487's spell copies aimed at
// the spell itself, each copy's new-targets question asked in turn. What is proven here: the readings (the Storm and the
// Cascade line leave a spell's clauses); two spells before Grapeshot make two copies that keep its target; a copy aimed
// anew; no spell before it, no copy; a storm spell countered in response is still copied, and the counterspell cast in
// response adds no copy; a PERMANENT spell with storm fires none (its copies would be tokens) and stays incomplete; a
// cascade SPELL (Violent Outburst) cascades and pumps; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { TargetChoice } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, sym: 'U' | 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
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
const bolt = (g: Game) => {
  const card = put(g, 'p1', 'Lightning Bolt', 'hand');
  mana(g, 'R', 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [P2] }));
  resolveAll(g);
};
const stormTrigger = (g: Game, from: number) => g.log.slice(from).find((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:storm'));
const copies = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'SpellCopied').length;

describe('D536 - storm', () => {
  test('the readings: Storm on the face, the Storm and Cascade lines out of the clauses, the three complete', () => {
    expect(faceNamed('Grapeshot').keywords).toContain('storm');
    expect(faceNamed('Grapeshot').effectMode).toBe('auto');
    expect(faceNamed('Tendrils of Agony').keywords).toContain('storm');
    expect(faceNamed('Violent Outburst').keywords).toContain('cascade');
    expect(faceNamed('Violent Outburst').effectMode).toBe('auto');
    for (const name of ['Grapeshot', 'Tendrils of Agony', 'Violent Outburst']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('two spells before it: two copies that keep the target', () => {
    const g = startedGame({ players: 2, decks: [['Grapeshot', 'Lightning Bolt', 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const shot = put(g, 'p1', 'Grapeshot', 'hand');
    main3(g);
    const life0 = life(g, 'p2');
    bolt(g);
    bolt(g);
    mana(g, 'R', 2);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shot, targets: [P2] }));
    const asked = resolveAll(g);
    const trig = stormTrigger(g, n0);
    expect(trig?.body.t === 'AbilityPutOnStack' ? trig.body.obj.memo : null, 'two spells were cast before it').toBe(2);
    expect(copies(g, n0)).toBe(2);
    expect(asked, 'each copy asked for new targets').toBe(2);
    expect(life(g, 'p2'), 'two Bolts, Grapeshot and its two copies').toBe(life0 - 6 - 3);
    expect(g.state.cards[shot]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a copy aimed anew; and with no spell before it, no copy', () => {
    const g = startedGame({ players: 2, decks: [['Grapeshot', 'Grapeshot', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const first = put(g, 'p1', 'Grapeshot', 'hand');
    const second = put(g, 'p1', 'Grapeshot', 'hand');
    main3(g);
    const [p1Life, p2Life] = [life(g, 'p1'), life(g, 'p2')];
    mana(g, 'R', 2);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first, targets: [P2] }));
    expect(resolveAll(g)).toBe(0);
    const t0 = stormTrigger(g, n0);
    expect(t0?.body.t === 'AbilityPutOnStack' ? t0.body.obj.memo : null, 'the first spell this turn').toBe(0);
    expect(copies(g, n0)).toBe(0);
    expect(life(g, 'p2')).toBe(p2Life - 1);
    mana(g, 'R', 2);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second, targets: [P2] }));
    expect(resolveAll(g, () => [P1]), 'one copy, asked').toBe(1);
    expect(copies(g, n1)).toBe(1);
    expect(life(g, 'p1'), 'the copy was aimed at its own controller').toBe(p1Life - 1);
    expect(life(g, 'p2'), 'the second Grapeshot itself').toBe(p2Life - 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a storm spell countered in response is still copied, and the counterspell adds no copy', () => {
    const g = startedGame({ players: 2, decks: [['Grapeshot', 'Negate', 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const shot = put(g, 'p1', 'Grapeshot', 'hand');
    const negate = put(g, 'p1', 'Negate', 'hand');
    main3(g);
    const life0 = life(g, 'p2');
    bolt(g);
    mana(g, 'R', 2);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shot, targets: [P2] }));
    advanceUntil(g, (s) => s.stack.length === 2 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const stack = g.state.stack.find((o) => o.card === shot);
    if (!stack) throw new Error('Grapeshot is not on the stack');
    mana(g, 'U', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: negate, targets: [{ kind: 'stack', id: stack.id }] }));
    expect(resolveAll(g), 'the one copy, off the snapshot').toBe(1);
    expect(g.log.slice(n0).some((e) => e.body.t === 'SpellCountered'), 'Grapeshot was countered').toBe(true);
    expect(copies(g, n0), 'one spell before it - Negate came after').toBe(1);
    expect(life(g, 'p2'), 'the Bolt and the copy, not the countered spell').toBe(life0 - 3 - 1);
    expect(g.state.cards[shot]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a PERMANENT spell's storm stays the player's: no trigger, the line not the engine's (its copies would be tokens)", () => {
    const technique = fixture('Tempest Technique');
    expect(faceNamed('Tempest Technique').keywords).toContain('storm');
    expect(isEngineComplete(technique), 'the Storm line on an Aura is no line the engine runs').toBe(false);
    const g = startedGame({ players: 2, decks: [['Tempest Technique', 'Lightning Bolt', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const aura = put(g, 'p1', 'Tempest Technique', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    main3(g);
    bolt(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    mana(g, 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura, targets: [{ kind: 'card', id: bears }] }));
    resolveAll(g);
    expect(stormTrigger(g, n0), 'no storm trigger off a permanent spell').toBeUndefined();
    expect(copies(g, n0)).toBe(0);
    expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a cascade SPELL cascades and resolves (its Cascade line was never read before)', () => {
    const g = startedGame({ players: 2, decks: [['Violent Outburst', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const outburst = put(g, 'p1', 'Violent Outburst', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    main3(g);
    mana(g, 'R', 1);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: outburst, targets: [] }));
    resolveAll(g);
    expect(g.log.slice(n0).some((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:cascade')), 'the cascade trigger').toBe(true);
    expect(g.log.slice(n0).some((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === 1), 'the pump').toBe(true);
    expect(g.state.cards[outburst]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

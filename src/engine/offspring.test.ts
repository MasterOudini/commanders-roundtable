// D558 - OFFSPRING (CR 702.175a): "You may pay an additional [cost] as you cast this spell. If you do, when this creature
// enters, create a 1/1 token copy of it." The cost rides the cast (`CastSpell.offspring` - buyback's path, priced at every
// stage), onto the permanent's entry (`CardMove.offspring` - the kick's path), and an enters trigger from the keyword
// table creates the copy (myriad's TokenCreated with a 1/1 exception on top). What is proven here: the reading (the cost
// on the face, the Offspring line the engine's on all eight); Coruscation Mage cast with its offspring makes one 1/1 token
// copy, whose own entry makes none; cast without it, no copy; the offer names the cost and whether the cast with it is
// payable, and a face with none refuses it; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { linesUnaccounted } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const OFFSPRING = ['Iridescent Vinelasher', 'Agate Instigator', 'Finch Formation', 'Tender Wildguide', 'Splash Lasher', 'Intrepid Rabbit', 'Steelburr Champion', 'Coruscation Mage'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, sym: 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const copiesOf = (g: Game, original: InstanceId) => Object.values(g.state.cards).filter((c) => c.isToken && c.zone.kind === 'battlefield' && c.oracleId === g.state.cards[original]?.oracleId);
const offspringTriggers = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:offspring')).length;
const offerOf = (g: Game, card: InstanceId) => legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);

describe('D558 - offspring', () => {
  test("the reading: the Offspring cost on the face, the line the engine's on all eight", () => {
    const d = deps();
    expect(d.oracle.byName('Coruscation Mage')?.faces[0]?.offspringCost?.raw).toBe('{2}');
    expect(d.oracle.byName('Intrepid Rabbit')?.faces[0]?.offspringCost?.raw).toBe('{1}');
    expect(d.oracle.byName('Coruscation Mage')?.faces[0]?.keywords).toContain('offspring');
    expect(d.oracle.byName('Grizzly Bears')?.faces[0]?.offspringCost).toBeNull();
    for (const name of OFFSPRING) {
      const card = fixture(name);
      const face = d.oracle.byName(name)?.faces[0];
      if (!face) throw new Error('no face ' + name);
      const open = linesUnaccounted(card.faces[0]?.oracleText ?? '', face, card.keywords).map((l) => l.text);
      expect(open.some((l) => /^Offspring/.test(l)), name + ': the Offspring line accounted').toBe(false);
    }
  });

  test('Coruscation Mage cast with its offspring: one 1/1 token copy, whose own entry makes none', () => {
    const g = startedGame({ players: 2, decks: [['Coruscation Mage', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const mage = put(g, 'p1', 'Coruscation Mage', 'hand');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mage, offspring: true }));
    settle(g);
    const cast = g.log.slice(n0).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.offspring : null, 'the stack object remembers it').toBe(true);
    expect(g.state.cards[mage]?.zone.kind).toBe('battlefield');
    const copies = copiesOf(g, mage);
    expect(copies.length, 'one token copy').toBe(1);
    const copy = copies[0] as (typeof copies)[number];
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, copy.id);
    expect([d.power, d.toughness], 'a 1/1 copy of a 2/2').toEqual([1, 1]);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, mage).power, 'the Mage itself unchanged').toBe(2);
    expect(offspringTriggers(g, n0), "the copy's entry carries no payment").toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('cast without its offspring: no trigger, no copy', () => {
    const g = startedGame({ players: 2, decks: [['Coruscation Mage', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const mage = put(g, 'p1', 'Coruscation Mage', 'hand');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mage }));
    settle(g);
    expect(g.state.cards[mage]?.zone.kind).toBe('battlefield');
    expect(copiesOf(g, mage).length).toBe(0);
    expect(offspringTriggers(g, n0)).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the offer names the cost and whether the cast with it is payable; a face with none refuses it', () => {
    const g = startedGame({ players: 2, decks: [['Coruscation Mage', 'Hill Giant', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const mage = put(g, 'p1', 'Coruscation Mage', 'hand');
    const giant = put(g, 'p1', 'Hill Giant', 'hand');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 1);
    const o1 = offerOf(g, mage);
    expect(o1?.t === 'CastSpell' ? [o1.affordable, o1.offspringCost, o1.offspringAffordable] : null, 'the base cast only').toEqual([true, '{2}', false]);
    mana(g, 'C', 2);
    const o2 = offerOf(g, mage);
    expect(o2?.t === 'CastSpell' ? o2.offspringAffordable : null, 'with the offspring').toBe(true);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: giant, offspring: true }).ok, 'Hill Giant has no offspring').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

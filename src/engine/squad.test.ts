// D564 - SQUAD (CR 702.157a): "As an additional cost to cast this spell, you may pay [cost] any number of times" and "When
// this creature enters, if its squad cost was paid, create a token that's a copy of it for each time its squad cost was
// paid." Replicate's count (D556 - `CastSpell.squadded`, priced at every stage, remembered by the stack object) carried onto
// the permanent's entry as offspring's payment is (D558 - `CardMove.squadded`), and the keyword table's enters trigger
// making that many token copies. What is proven here: the readings (the Squad cost on the face, the keyword the engine's;
// a squad cost that is not only mana unread); Vanguard Suppressor cast with its squad cost paid twice - two token copies
// enter beside it, and they make none of their own; cast without it - no trigger, one creature; the offer names the cost
// and whether one payment is payable; a count on a face with no squad cost is refused; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const FILL = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, sym: 'U' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const squadTriggers = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:squad')).length;
const suppressors = (g: Game) => g.state.zones.battlefield.filter((id) => {
  const c = g.state.cards[id];
  return c !== undefined && c.controller === 'p1' && deps().oracle.byPrinting(c.printingId)?.name === 'Vanguard Suppressor';
});

function armed(): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Vanguard Suppressor', 'Grizzly Bears', ...FILL], [...FILL]] });
  settle(g);
  holdEverywhere(g);
  const card = put(g, 'p1', 'Vanguard Suppressor', 'hand');
  main3(g);
  return { g, card };
}

describe('D564 - squad', () => {
  test('the readings: the Squad cost on the face, the keyword the engine' + "'" + 's; a squad cost that is not only mana unread', () => {
    expect(faceNamed('Vanguard Suppressor').squadCost?.raw).toBe('{2}');
    expect(faceNamed('Vanguard Suppressor').keywords).toContain('squad');
    expect(faceNamed('Powder Ganger').squadCost?.raw).toBe('{2}');
    expect(faceNamed('Grizzly Bears').squadCost).toBeNull();
  });

  test('Vanguard Suppressor squadded twice: two token copies enter beside it, and they make none of their own', () => {
    const { g, card } = armed();
    mana(g, 'U', 1);
    mana(g, 'C', 7);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card, squadded: 2 }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(squadTriggers(g, n0), 'one trigger - the copies carry no payment').toBe(1);
    const all = suppressors(g);
    expect(all).toHaveLength(3);
    expect(all.filter((id) => g.state.cards[id]?.isToken === true)).toHaveLength(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('cast without the squad cost: no trigger, one creature', () => {
    const { g, card } = armed();
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(squadTriggers(g, n0)).toBe(0);
    expect(suppressors(g)).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the offer names the squad cost and whether one payment is payable; a count on a face without squad is refused', () => {
    const { g, card } = armed();
    mana(g, 'U', 1);
    mana(g, 'C', 5);
    const offer = legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);
    expect(offer?.t === 'CastSpell' ? [offer.affordable, offer.squadCost, offer.squadAffordable] : null).toEqual([true, '{2}', true]);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bears, squadded: 1 }).ok, 'Grizzly Bears has no squad').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card, squadded: -1 }).ok, 'a negative count').toBe(false);
  });
});

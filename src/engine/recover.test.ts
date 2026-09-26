// D561 - RECOVER (CR 702.59a): "When a creature is put into your graveyard from the battlefield, you may pay [cost]. If you
// do, return this card from your graveyard to your hand. Otherwise, exile this card." A keyword-table trigger that works
// from the GRAVEYARD (`fromGraveyard`, looked back - the card was there before the creature died), its price D369's pay
// prompt with two arms (`recoverSpec`). What is proven here: the readings (the Recover cost on the face, the line out of
// the clauses, the six complete; Garza's Assassin's half-life recover unread); Sun's Bounty in the graveyard as p1's
// creature dies - the price paid returns it to hand, declined it is exiled, and with no way to pay there is no question
// and it is exiled; an opponent's creature dying into its own graveyard fires nothing; two creatures at once fire twice;
// a Krovikan Rot that kills p1's own creature as it resolves was on the stack, not in the graveyard - no trigger - and
// the next death finds it there; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const RECOVER = ['Controvert', 'Krovikan Rot', 'Icefall', 'Grim Harvest', "Sun's Bounty", 'Resize'];
const FILL = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const zoneOf = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';
const recoverTriggers = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:recover')).length;
const asked = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana').length;
const dies = (g: Game, id: InstanceId, owner: 'p1' | 'p2') => must(g.submit({ t: 'ManualMoveCard', player: owner, card: id, to: { kind: 'graveyard', player: owner } }));
const toPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);

/** p1: Sun's Bounty in the graveyard, two Grizzly Bears and `plains` Plains on the battlefield; p2: a Grizzly Bears. */
function armed(plains: number): { g: Game; bounty: InstanceId; bears: InstanceId; bears2: InstanceId; theirs: InstanceId } {
  const g = startedGame({ players: 2, decks: [["Sun's Bounty", 'Grizzly Bears', 'Grizzly Bears', 'Plains', 'Plains', ...FILL], ['Grizzly Bears', ...FILL]] });
  settle(g);
  holdEverywhere(g);
  const bounty = put(g, 'p1', "Sun's Bounty", 'graveyard');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const bears2 = put(g, 'p1', 'Grizzly Bears');
  for (let i = 0; i < plains; i++) put(g, 'p1', 'Plains');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  return { g, bounty, bears, bears2, theirs };
}

describe('D561 - recover', () => {
  test('the readings: the Recover cost on the face, the line out of the clauses, the six complete', () => {
    expect(faceNamed("Sun's Bounty").recoverCost?.raw).toBe('{1}{W}');
    expect(faceNamed("Sun's Bounty").keywords).toContain('recover');
    expect(faceNamed("Sun's Bounty").effectMode).toBe('auto');
    expect(faceNamed('Controvert').recoverCost?.raw).toBe('{2}{U}{U}');
    expect(faceNamed("Garza's Assassin").recoverCost, 'a recover cost that is not only mana stays unread').toBeNull();
    expect(faceNamed("Garza's Assassin").keywords).not.toContain('recover');
    expect(faceNamed('Lightning Bolt').recoverCost).toBeNull();
    for (const name of RECOVER) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test("p1's creature dies with Sun's Bounty in the graveyard: the price paid returns it to hand", () => {
    const { g, bounty, bears } = armed(2);
    const n0 = g.log.length;
    dies(g, bears, 'p1');
    toPrompt(g);
    const a = g.state.priority.awaiting;
    expect(a?.kind === 'payMana' ? a.cost?.raw : null).toBe('{1}{W}');
    expect(a?.kind === 'payMana' ? a.player : null).toBe('p1');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(g);
    expect(recoverTriggers(g, n0)).toBe(1);
    expect(zoneOf(g, bounty), 'returned to its owner' + "'" + 's hand').toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined, the card is exiled; with no way to pay there is no question and it is exiled', () => {
    const { g, bounty, bears } = armed(2);
    dies(g, bears, 'p1');
    toPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(zoneOf(g, bounty), 'declined: exiled').toBe('exile');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

    const poor = armed(0);
    const n0 = poor.g.log.length;
    dies(poor.g, poor.bears, 'p1');
    settle(poor.g);
    expect(recoverTriggers(poor.g, n0)).toBe(1);
    expect(asked(poor.g, n0), 'an unpayable price is no question').toBe(0);
    expect(zoneOf(poor.g, poor.bounty), 'unpayable: exiled').toBe('exile');
    expect(stateHash(replay(poor.g.log, poor.g.seed))).toBe(poor.g.hash());
  });

  test("an opponent's creature dying into its own graveyard fires nothing; two of p1's at once fire twice", () => {
    const { g, bounty, bears, bears2, theirs } = armed(2);
    const n0 = g.log.length;
    dies(g, theirs, 'p2');
    settle(g);
    expect(recoverTriggers(g, n0), "not p1's graveyard").toBe(0);
    expect(zoneOf(g, bounty)).toBe('graveyard');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears2, to: { kind: 'graveyard', player: 'p1' } }));
    toPrompt(g);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
    if (g.state.priority.awaiting?.kind === 'payMana') must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(recoverTriggers(g, n0), 'one trigger per creature').toBe(2);
    expect(zoneOf(g, bounty), 'the first paid - back in hand; the second finds it gone').toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a Krovikan Rot that kills p1' + "'" + 's own creature as it resolves was on the stack - no trigger; the next death finds it', () => {
    const g = startedGame({ players: 2, decks: [['Krovikan Rot', 'Grizzly Bears', 'Grizzly Bears', 'Swamp', 'Swamp', 'Swamp', ...FILL], [...FILL]] });
    settle(g);
    holdEverywhere(g);
    const rot = put(g, 'p1', 'Krovikan Rot', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const bears2 = put(g, 'p1', 'Grizzly Bears');
    for (let i = 0; i < 3; i++) put(g, 'p1', 'Swamp');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rot, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(zoneOf(g, bears), 'destroyed').toBe('graveyard');
    expect(zoneOf(g, rot), 'the Rot went to the graveyard after its clauses').toBe('graveyard');
    expect(recoverTriggers(g, n0), 'the Rot was on the stack as the Bears died').toBe(0);
    const n1 = g.log.length;
    dies(g, bears2, 'p1');
    toPrompt(g);
    const a = g.state.priority.awaiting;
    expect(a?.kind === 'payMana' ? a.cost?.raw : null).toBe('{1}{B}{B}');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(g);
    expect(recoverTriggers(g, n1)).toBe(1);
    expect(zoneOf(g, rot), 'recovered').toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

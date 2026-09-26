// D562 - ENLIST (CR 702.154a): "As this creature attacks, you may tap up to one untapped creature you control that you
// didn't choose to attack with and that either has haste or has been under your control continuously since this turn
// began. When you do, add its power to this creature's until end of turn." Exert's shape (D443): the attack prompt lists
// the enlisting attackers and the candidates (`enlist`, absent when none may), the declaration names the enlisted
// creature, the host taps it and the keyword table's trigger fires off the enlistment (`Enlisted`), the power read as it
// resolves. What is proven here: the readings (the keyword the engine's; the five bare-keyword creatures complete);
// the prompt's candidates (never a creature that came this turn) and no `enlist` without an enlisting attacker; Coalition
// Warbrute enlisting Grizzly Bears - the Bears tapped, the trigger adds 2, p2 takes 5; the host refuses an enlistment of
// itself, of an attacker, of a sick creature, of one creature twice, and by an attacker without enlist; an enlisted
// creature that has left adds its last known power; the bot enlists the spare candidate; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { chooseAttacks } from '../bot/combat';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { project } from './project';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const SCRIPTS = createRegistry([]);
const FILL = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const BARE = ['Benalish Faithbonder', 'Barkweave Crusher', 'Coalition Warbrute', 'Coalition Skyknight', 'Hexbane Tortoise'];
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: PlayerId) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const at = (id: PlayerId) => ({ kind: 'player', id }) as const;
const pumps = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:enlist')).length;
const attackPrompt = (g: Game, turn: number) => {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
  const awaiting = g.state.priority.awaiting;
  if (awaiting?.kind !== 'declareAttackers') throw new Error('no attack prompt');
  return awaiting;
};
const afterCombat = (g: Game) => advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null && s.stack.length === 0, 20_000);

/** p1: Coalition Warbrute (3/4 trample, enlist), Barkweave Crusher (2/5, enlist) and Grizzly Bears from turn 1; p2: an empty board. */
function armed(): { g: Game; warbrute: InstanceId; crusher: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Coalition Warbrute', 'Barkweave Crusher', 'Grizzly Bears', 'Grizzly Bears', ...FILL], [...FILL]], scripts: SCRIPTS });
  settle(g);
  holdEverywhere(g);
  const warbrute = put(g, 'p1', 'Coalition Warbrute');
  const crusher = put(g, 'p1', 'Barkweave Crusher');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return { g, warbrute, crusher, bears };
}

describe('D562 - enlist', () => {
  test('the readings: the keyword the engine' + "'" + 's, the five bare-keyword creatures complete', () => {
    const c = deps().oracle.byName('Coalition Warbrute');
    if (!c) throw new Error('no fixture');
    expect(faceOf(c, 0).keywords).toContain('enlist');
    for (const name of BARE) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('the prompt lists the enlisting attackers and the candidates - never a creature that came this turn', () => {
    const { g, warbrute, crusher, bears } = armed();
    main(g, 3, 'p1');
    const sick = put(g, 'p1', 'Grizzly Bears');
    const prompt = attackPrompt(g, 3);
    expect([...(prompt.enlist?.attackers ?? [])].sort()).toEqual([warbrute, crusher].sort());
    expect(prompt.enlist?.candidates).toEqual(expect.arrayContaining([warbrute, crusher, bears]));
    expect(prompt.enlist?.candidates, 'summoning sick').not.toContain(sick);

    const plain = startedGame({ players: 2, decks: [['Grizzly Bears', 'Grizzly Bears', ...FILL], [...FILL]], scripts: SCRIPTS });
    settle(plain);
    holdEverywhere(plain);
    put(plain, 'p1', 'Grizzly Bears');
    put(plain, 'p1', 'Grizzly Bears');
    expect(attackPrompt(plain, 3).enlist, 'no enlisting attacker - no field').toBeUndefined();
  });

  test('Coalition Warbrute enlists Grizzly Bears: the Bears tapped, the trigger adds 2, p2 takes 5', () => {
    const { g, warbrute, bears } = armed();
    attackPrompt(g, 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: warbrute, defender: at('p2'), enlist: bears }] }));
    expect(g.state.cards[bears]?.tapped, 'tapped with the declaration').toBe(true);
    expect(g.log.slice(n0).some((e) => e.body.t === 'Enlisted' && e.body.card === warbrute && e.body.enlisted === bears)).toBe(true);
    afterCombat(g);
    expect(pumps(g, n0)).toBe(1);
    expect(g.state.players.p2?.life, '3 + the enlisted 2').toBe(35);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the host refuses: itself, an attacker, a sick creature, one creature twice, an attacker without enlist', () => {
    const { g, warbrute, crusher, bears } = armed();
    main(g, 3, 'p1');
    const sick = put(g, 'p1', 'Grizzly Bears');
    attackPrompt(g, 3);
    const P2 = at('p2');
    const refused = (attackers: readonly { card: InstanceId; defender: typeof P2; enlist?: InstanceId }[], why: string) =>
      expect(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers }).ok, why).toBe(false);
    refused([{ card: warbrute, defender: P2, enlist: warbrute }], 'itself');
    refused([{ card: warbrute, defender: P2, enlist: bears }, { card: bears, defender: P2 }], 'an attacker');
    refused([{ card: warbrute, defender: P2, enlist: sick }], 'a creature that came this turn');
    refused([{ card: warbrute, defender: P2, enlist: bears }, { card: crusher, defender: P2, enlist: bears }], 'one creature twice');
    refused([{ card: bears, defender: P2, enlist: crusher }], 'an attacker without enlist');
    const n0 = g.log.length;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: warbrute, defender: P2, enlist: bears }, { card: crusher, defender: P2 }] }));
    afterCombat(g);
    expect(pumps(g, n0)).toBe(1);
    expect(g.state.players.p2?.life, 'the Warbrute 5 and the Crusher 2').toBe(33);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an enlisted creature that leaves before the trigger resolves adds its last known power', () => {
    const { g, warbrute, bears } = armed();
    attackPrompt(g, 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: warbrute, defender: at('p2'), enlist: bears }] }));
    advanceUntil(g, (s) => s.stack.some((o) => (o.abilityRef ?? '').endsWith('#kw:enlist')) && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    afterCombat(g);
    expect(pumps(g, n0)).toBe(1);
    expect(g.state.players.p2?.life, 'the last known 2 added').toBe(35);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the bot enlists the spare candidate the attack leaves home', () => {
    const { g, warbrute, crusher, bears } = armed();
    const prompt = attackPrompt(g, 3);
    const view = project(g.state, deps(SCRIPTS).oracle, SCRIPTS, 'p1');
    // The Warbrute alone may attack (as though the others were held out): the Bears and the Crusher are the spare
    // candidates (power 2 each - the tie goes by id), and one of them is taken.
    const attacks = chooseAttacks(view, { ...prompt, attackers: [warbrute] }, 'p1');
    expect(attacks.map((a) => a.card)).toEqual([warbrute]);
    expect([bears, crusher]).toContain(attacks[0]?.enlist);
    // Every candidate attacking, nothing is spare: no enlistment.
    const all = chooseAttacks(view, { ...prompt, attackers: [warbrute, bears] }, 'p1');
    expect(all.some((a) => a.card === warbrute && a.enlist === bears), 'an attacker is never enlisted').toBe(false);
  });
});

// WARD AGAINST A SPELL COPY (CR 702.21a, 707.10c). Ward is charged as a CAST-TIME TAX (`wardTaxFor`, D68) - and a copy is
// never cast, so nothing ever charged it: a copy retargeted at an opponent's Toadstool Admirer (Ward {2}) killed it with no
// payment asked, while the same spell cast at the Admirer was refused short of the tax (the D585 review's find, on the
// copy-targets prompt storm, replicate, conspire, Twincast and Reverberate share). The ward now TRIGGERS for a copy once its
// targets are settled - put on the stack with no question about them, or the question answered (kept or new) - one trigger
// per ward of each permanent it targets that an opponent of its controller controls, controlled by that permanent's
// controller, above the copy: counter it unless its controller pays (D369's prompt). What is proven here: the retargeted
// copy countered when its controller cannot pay (the trigger's shape: the Admirer's controller, the Admirer, the copy bound
// as its aim); paid, the copy resolves; declined, it is countered; a copy that KEEPS a warded target triggers it again (the
// original paid the tax); a copy aimed AWAY from it does not (CR 707.10c - the copy is put on the stack with its final
// targets), nor one aimed at its own controller's warded creature; a life ward asks the life; a face-down disguised
// creature's ward {2}, its trigger never naming it; storm's two copies, each settled by its own answer; two wards on one
// creature (a Royal Role's beside the printed one) are two triggers, each asked; three players, two opponents' wards met
// by one copy - a trigger each, each its own controller's, the first unpaid countering it; a copy that asks no question
// triggers it as it is made; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { ROYAL_YOUNG_HERO_ROLE_SCRIPT } from './scripts/cards/royalYoungHeroRole';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId, PlayerId, StackId } from './types/ids';
import type { EventBody } from './types/events';
import type { StackObject } from './types/state';

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: PlayerId, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const top = (g: Game) => g.state.stack[g.state.stack.length - 1]?.id as StackId;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const life = (g: Game, who: PlayerId) => g.state.players[who]?.life ?? -1;
const pool = (g: Game, who: PlayerId) => Object.values(g.state.players[who]?.pool ?? {}).reduce((a, b) => a + b, 0);
const since = (g: Game, n0: number): EventBody[] => g.log.slice(n0).map((e) => e.body);
const wardTriggers = (g: Game, n0: number): StackObject[] => since(g, n0).flatMap((b) => (b.t === 'AbilityPutOnStack' && String(b.obj.abilityRef ?? '').endsWith('#ward') ? [b.obj] : []));
const countered = (g: Game, n0: number, id: StackId) => since(g, n0).some((b) => b.t === 'SpellCountered' && b.stackId === id);
const payAsks = (g: Game, n0: number) => since(g, n0).flatMap((b) => (b.t === 'AwaitingSet' && b.awaiting?.kind === 'payMana' ? [b.awaiting] : []));
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

/** Passes until the copy's new-targets question is up; its copy's stack id. */
function copyAsked(g: Game): StackId {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseTargets' || a.forKind !== 'copy') throw new Error('no copy-targets prompt');
  return a.stackId;
}

/** Passes until the ward's payment prompt is up (the trigger resolving). */
function wardAsked(g: Game) {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'payMana') throw new Error('no payment prompt');
  return a;
}

/**
 * p2 controls Grizzly Bears and a Toadstool Admirer (Ward {2}); p1, in their third main phase, casts Lightning Bolt at the
 * Bears and then Reverberate copying it, and the copy's new-targets question is up. p1 pays exactly {R}{R}{R} (plus `extra`
 * floating), so nothing is left for the ward unless `extra` says so.
 */
function copyAtTheBears(extra = '') {
  const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Reverberate'], ['Grizzly Bears', 'Toadstool Admirer']], options: { maxHandSize: null } });
  holdEverywhere(g);
  main3(g);
  const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
  const rev = put(g, 'p1', 'Reverberate', 'hand');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const admirer = put(g, 'p2', 'Toadstool Admirer');
  mana(g, 'p1', 'R');
  expect(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: admirer }] }).ok, 'the Bolt cast at the Admirer is refused short of the ward tax').toBe(false);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
  const boltObj = top(g);
  mana(g, 'p1', 'RR' + extra);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: boltObj }] }));
  const copy = copyAsked(g);
  return { g, bears, admirer, copy };
}

describe('ward against a spell copy (CR 702.21a)', () => {
  test('the copy retargeted at an opponent warded creature: the ward triggers, and countered unpaid, the creature lives', () => {
    const { g, bears, admirer, copy } = copyAtTheBears();
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: admirer }] }));
    settle(g);
    const wards = wardTriggers(g, n0);
    expect(wards, 'one ward trigger').toHaveLength(1);
    expect(wards[0]?.controller, 'the warded creature controller controls it').toBe('p2');
    expect(wards[0]?.source).toBe(admirer);
    expect(wards[0]?.targets, 'the copy rides as its aim').toEqual([{ kind: 'stack', id: copy }]);
    expect(wards[0]?.label).toBe('Toadstool Admirer - ward');
    expect(payAsks(g, n0), 'p1 cannot pay {2}: nothing is asked').toHaveLength(0);
    expect(countered(g, n0, copy), 'the copy is countered').toBe(true);
    expect(zoneOf(g, admirer), 'the Admirer lives').toBe('battlefield');
    expect(zoneOf(g, bears), 'the original Bolt still resolves').toBe('graveyard');
    hashHolds(g);
  });

  test('paid, the copy resolves; declined, it is countered', () => {
    const paid = copyAtTheBears('CC');
    const n0 = paid.g.log.length;
    must(paid.g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: paid.admirer }] }));
    const ask = wardAsked(paid.g);
    expect(ask.player, 'the copy controller pays').toBe('p1');
    expect(ask.cost?.raw).toBe('{2}');
    expect(ask.life).toBe(0);
    expect(ask.label).toBe('Toadstool Admirer - ward');
    expect(ask.targets).toEqual([{ kind: 'stack', id: paid.copy }]);
    expect(paid.g.state.stack.map((o) => o.id), 'the copy is still on the stack, under the resolving trigger').toContain(paid.copy);
    must(paid.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    expect(pool(paid.g, 'p1'), 'the {2} was paid').toBe(0);
    settle(paid.g);
    expect(countered(paid.g, n0, paid.copy)).toBe(false);
    expect(zoneOf(paid.g, paid.admirer), 'the copy killed the Admirer').toBe('graveyard');
    expect(zoneOf(paid.g, paid.bears)).toBe('graveyard');
    hashHolds(paid.g);

    const declined = copyAtTheBears('CC');
    const n1 = declined.g.log.length;
    must(declined.g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: declined.admirer }] }));
    wardAsked(declined.g);
    must(declined.g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    expect(pool(declined.g, 'p1'), 'nothing was paid').toBe(2);
    settle(declined.g);
    expect(countered(declined.g, n1, declined.copy)).toBe(true);
    expect(zoneOf(declined.g, declined.admirer)).toBe('battlefield');
    hashHolds(declined.g);
  });

  test('a copy that keeps a warded target triggers the ward again; one aimed away does not', () => {
    for (const keep of [true, false]) {
      const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Reverberate'], ['Toadstool Admirer']], options: { maxHandSize: null } });
      holdEverywhere(g);
      main3(g);
      const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
      const rev = put(g, 'p1', 'Reverberate', 'hand');
      const admirer = put(g, 'p2', 'Toadstool Admirer');
      mana(g, 'p1', 'RCC');
      must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: admirer }] }));
      expect(pool(g, 'p1'), 'the cast paid the ward tax').toBe(0);
      const boltObj = top(g);
      mana(g, 'p1', 'RR');
      must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: boltObj }] }));
      const copy = copyAsked(g);
      const n0 = g.log.length;
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: keep ? [] : [{ kind: 'player', id: 'p2' }] }));
      settle(g);
      expect(wardTriggers(g, n0), keep ? 'kept: the copy becomes its target too' : 'aimed away: the copy never targets it').toHaveLength(keep ? 1 : 0);
      expect(countered(g, n0, copy)).toBe(keep);
      expect(life(g, 'p2'), keep ? 'the copy was countered' : 'the copy hit p2').toBe(keep ? 40 : 37);
      expect(zoneOf(g, admirer), 'the original Bolt kills it either way').toBe('graveyard');
      hashHolds(g);
    }
  });

  test('only an opponent permanent wards: a copy aimed at its controller own warded creature triggers nothing', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Reverberate', 'Toadstool Admirer'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const mine = put(g, 'p1', 'Toadstool Admirer');
    const bears = put(g, 'p2', 'Grizzly Bears');
    mana(g, 'p1', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    const boltObj = top(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: boltObj }] }));
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(wardTriggers(g, n0)).toHaveLength(0);
    expect(countered(g, n0, copy)).toBe(false);
    expect(zoneOf(g, mine), 'the copy resolved at it').toBe('graveyard');
    hashHolds(g);
  });

  test('a life ward asks the life (Ward - Pay 3 life)', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Reverberate'], ['Grizzly Bears', 'Sedgemoor Witch']], options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    const witch = put(g, 'p2', 'Sedgemoor Witch');
    mana(g, 'p1', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    const boltObj = top(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: boltObj }] }));
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: witch }] }));
    const ask = wardAsked(g);
    expect(ask.player).toBe('p1');
    expect(ask.cost).toBeNull();
    expect(ask.life).toBe(3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    expect(life(g, 'p1'), 'p1 paid 3 life').toBe(37);
    settle(g);
    expect(countered(g, n0, copy)).toBe(false);
    expect(zoneOf(g, witch), 'the copy killed the Witch').toBe('graveyard');
    hashHolds(g);
  });

  test('a face-down disguised creature wards {2} (D460), and its trigger never names it', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Reverberate'], ['Grizzly Bears', 'Museum Nightwatch']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const nightwatch = put(g, 'p2', 'Museum Nightwatch', 'hand');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    mana(g, 'p2', 'CCC');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: nightwatch, faceDown: true, targets: [] }));
    settle(g);
    expect(g.state.cards[nightwatch]?.faceDown).toBe(true);
    main3(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    mana(g, 'p1', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    const boltObj = top(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: boltObj }] }));
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: nightwatch }] }));
    settle(g);
    const wards = wardTriggers(g, n0);
    expect(wards).toHaveLength(1);
    expect(wards[0]?.label).toBe('A face-down creature - ward');
    const lines = since(g, n0).flatMap((b) => (b.t === 'Narrated' ? [b.text] : []));
    expect(lines.filter((t) => t.includes('Museum Nightwatch')), 'the hidden card is never named').toEqual([]);
    expect(countered(g, n0, copy)).toBe(true);
    expect(zoneOf(g, nightwatch)).toBe('battlefield');
    expect(g.state.cards[nightwatch]?.faceDown, 'still face down').toBe(true);
    hashHolds(g);
  });

  test('storm: each copy is settled by its own answer - the kept one triggers the ward, the one aimed away does not', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Lightning Bolt', 'Grapeshot'], ['Toadstool Admirer']], options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const bolt1 = put(g, 'p1', 'Lightning Bolt', 'hand');
    const bolt2 = put(g, 'p1', 'Lightning Bolt', 'hand');
    const shot = put(g, 'p1', 'Grapeshot', 'hand');
    const admirer = put(g, 'p2', 'Toadstool Admirer');
    // Two spells cast (and resolved - Grapeshot is a sorcery) before it this turn: storm 2.
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt1, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt2, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    mana(g, 'p1', 'RCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shot, targets: [{ kind: 'card', id: admirer }] }));
    expect(pool(g, 'p1'), 'Grapeshot paid the ward tax').toBe(0);
    const n0 = g.log.length;
    const first = copyAsked(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    const second = copyAsked(g);
    expect(second).not.toBe(first);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    const wards = wardTriggers(g, n0);
    expect(wards, 'the kept copy alone').toHaveLength(1);
    expect(wards[0]?.targets).toEqual([{ kind: 'stack', id: first }]);
    expect(countered(g, n0, first)).toBe(true);
    expect(countered(g, n0, second)).toBe(false);
    expect(life(g, 'p2'), 'two Bolts and the second copy').toBe(33);
    expect(zoneOf(g, admirer), 'the original Grapeshot').toBe('graveyard');
    hashHolds(g);
  });

  test('two wards on one creature (printed {2}, a Royal Role granted {1}) are two triggers, each asked', () => {
    const ROYAL = 'Create a Royal Role token attached to target creature you control.';
    const MAKER: CardScript = {
      oracleId: LLANOWAR_ELVES.oracleId,
      name: LLANOWAR_ELVES.name,
      triggers: [
        {
          abilityId: 'etb-royal',
          text: 'When this creature enters, ' + ROYAL,
          event: 'CardsMoved',
          activeZones: ['battlefield'],
          optional: false,
          matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
          targets: vocabularyTargets(ROYAL),
          label: () => 'Llanowar Elves - a Royal Role',
          resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(ROYAL, LLANOWAR_ELVES.name), vocabularyTargets(ROYAL)),
        },
      ],
    };
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Reverberate'], ['Toadstool Admirer', 'Llanowar Elves']], scripts: createRegistry([ROYAL_YOUNG_HERO_ROLE_SCRIPT, MAKER]), options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const admirer = put(g, 'p2', 'Toadstool Admirer');
    put(g, 'p2', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: admirer }] }));
    settle(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    mana(g, 'p1', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    const boltObj = top(g);
    mana(g, 'p1', 'RRCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: boltObj }] }));
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: admirer }] }));
    const asked: string[] = [];
    for (let i = 0; i < 2; i++) {
      const ask = wardAsked(g);
      expect(ask.player).toBe('p1');
      asked.push(ask.cost?.raw ?? '');
      must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    }
    expect(asked.sort(), 'one prompt per ward').toEqual(['{1}', '{2}']);
    settle(g);
    expect(wardTriggers(g, n0).map((o) => o.controller)).toEqual(['p2', 'p2']);
    expect(pool(g, 'p1'), 'both paid').toBe(0);
    expect(countered(g, n0, copy)).toBe(false);
    expect(zoneOf(g, admirer), 'the copy resolved at it').toBe('graveyard');
    hashHolds(g);
  });

  test('three players: a copy meeting two opponents wards fires one trigger for each, each its controller; the first unpaid counters it', () => {
    // Explosive Entry: `Destroy up to one target artifact. Put a +1/+1 counter on up to one target creature.`
    const g = startedGame({ players: 3, decks: [['Explosive Entry', 'Twincast'], ['Patchwork Automaton', 'Memnite'], ['Aegis Sculptor', 'Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    const entry = put(g, 'p1', 'Explosive Entry', 'hand');
    const twin = put(g, 'p1', 'Twincast', 'hand');
    const automaton = put(g, 'p2', 'Patchwork Automaton');
    const memnite = put(g, 'p2', 'Memnite');
    const sculptor = put(g, 'p3', 'Aegis Sculptor');
    const bears = put(g, 'p3', 'Grizzly Bears');
    mana(g, 'p1', 'RC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: entry, targets: [{ kind: 'card', id: memnite }, { kind: 'card', id: bears }] }));
    const entryObj = top(g);
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin, targets: [{ kind: 'stack', id: entryObj }] }));
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: automaton }, { kind: 'card', id: sculptor }] }));
    settle(g);
    const wards = wardTriggers(g, n0);
    expect(wards.map((o) => [o.controller, o.source]).sort(), 'one per opponent warded permanent').toEqual([['p2', automaton], ['p3', sculptor]].sort());
    expect(payAsks(g, n0), 'p1 has nothing left: nothing is asked').toHaveLength(0);
    expect(since(g, n0).filter((b) => b.t === 'SpellCountered' && b.stackId === copy), 'countered once').toHaveLength(1);
    expect(zoneOf(g, automaton), 'the copy never destroyed it').toBe('battlefield');
    expect(g.state.cards[sculptor]?.counters['+1/+1'] ?? 0, 'nor put a counter on it').toBe(0);
    expect(zoneOf(g, memnite), 'the original destroyed Memnite').toBe('graveyard');
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0, 'and put a counter on the Bears').toBe(1);
    hashHolds(g);
  });

  test('a copy that asks no question (`Copy target instant or sorcery spell.`) triggers the ward as it is made', () => {
    const COPY = 'Copy target instant or sorcery spell.';
    const COPIER: CardScript = {
      oracleId: LLANOWAR_ELVES.oracleId,
      name: LLANOWAR_ELVES.name,
      triggers: [
        {
          abilityId: 'cast-copy',
          text: 'Whenever you cast an instant or sorcery spell, copy target instant or sorcery spell.',
          event: 'SpellCast',
          activeZones: ['battlefield'],
          optional: false,
          matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.state.cards[self]?.controller,
          targets: vocabularyTargets(COPY),
          label: () => 'Llanowar Elves - a copy',
          resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(COPY, LLANOWAR_ELVES.name), vocabularyTargets(COPY)),
        },
      ],
    };
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Llanowar Elves'], ['Toadstool Admirer']], scripts: createRegistry([COPIER]), options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    put(g, 'p1', 'Llanowar Elves');
    const admirer = put(g, 'p2', 'Toadstool Admirer');
    mana(g, 'p1', 'RCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: admirer }] }));
    // The copier's trigger goes on the stack with the cast (above the Bolt), asking for its target.
    const boltObj = g.state.stack.find((o) => o.card === bolt)?.id as StackId;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'trigger', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: boltObj }] }));
    const n0 = g.log.length;
    settle(g);
    const made = since(g, n0).flatMap((b) => (b.t === 'SpellCopied' ? [b.obj] : []));
    expect(made, 'one copy, keeping the Bolt target').toHaveLength(1);
    expect(made[0]?.targets).toEqual([{ kind: 'card', id: admirer }]);
    expect(since(g, n0).some((b) => b.t === 'AwaitingSet' && b.awaiting?.kind === 'chooseTargets'), 'no question about its targets').toBe(false);
    const wards = wardTriggers(g, n0);
    expect(wards).toHaveLength(1);
    expect(wards[0]?.targets).toEqual([{ kind: 'stack', id: made[0]?.id }]);
    expect(countered(g, n0, made[0]?.id as StackId), 'p1 has nothing left: countered').toBe(true);
    expect(zoneOf(g, admirer), 'the original Bolt').toBe('graveyard');
    hashHolds(g);
  });
});

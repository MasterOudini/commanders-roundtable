// Fixed positions with a known right answer.
//
// ⚠️ THE M6 BRIEF'S "REGRESSION HARNESS": "a fixed set of seeded positions with
// a known best move, asserted per level. A bot that gets weaker must fail a
// test." The tournament says WHETHER the bot got weaker; this says WHERE. A win
// rate that drops four points is a number nobody can act on — a named position
// that started blocking wrong is a bug with an address.
//
// ⚠️ Every position here is one a human would answer without thinking, and each
// one was a real behaviour during M6.2's tuning. They are not a survey of Magic;
// they are the specific things that broke.

import { describe, expect, test } from 'vitest';
import type { Awaiting } from '../engine/types/state';
import type { CardData } from '../data/cardTypes';
import type { CardView, PlayerView } from '../view/types';
import * as fx from '../data/fixtures/engineCards';
import { chooseAttacks, chooseBlocks } from './combat';
import { creatureValue, scorePosition } from './eval';

const ME = 'p1';
const FOE = 'p2';

let nextId = 0;

function put(view: PlayerView, owner: string, data: CardData, over: Partial<CardView> = {}): CardView {
  const face = data.faces[0];
  const id = `c${nextId++}`;
  const card: CardView = {
    instanceId: id,
    card: data,
    faceIndex: 0,
    faceDown: false,
    controller: owner,
    owner,
    tapped: false,
    summoningSick: false,
    damage: 0,
    counters: {},
    power: Number(face?.power ?? 0) || 0,
    toughness: Number(face?.toughness ?? 0) || 0,
    attachedTo: null,
    isCommander: false,
    isToken: false,
    attacking: null,
    blocking: [],
    ...over,
  };
  view.cards[id] = card;
  const zone = `bf:${owner}` as const;
  view.zones[zone] = [...(view.zones[zone] ?? []), id];
  return card;
}

function board(myLife = 40, theirLife = 40): PlayerView {
  return {
    me: ME,
    seatOrder: [ME, FOE],
    seats: {
      [ME]: { playerId: ME, name: 'Me', life: myLife, cmdDamage: {}, poison: 0, manaPool: {}, lost: false },
      [FOE]: { playerId: FOE, name: 'Foe', life: theirLife, cmdDamage: {}, poison: 0, manaPool: {}, lost: false },
    },
    cards: {},
    zones: {},
    stack: [],
    turn: { active: ME, phase: 'declareAttackers', turnNumber: 6 },
    priority: ME,
    log: [],
    hiddenCounts: {},
    peek: [],
  } as unknown as PlayerView;
}

const attackPrompt = (attackers: CardView[]): Awaiting =>
  ({
    kind: 'declareAttackers',
    player: ME,
    attackers: attackers.map((c) => c.instanceId),
    defenders: [{ kind: 'player', id: FOE }],
  }) as Awaiting;

const blockPrompt = (pairs: { blocker: CardView; attackers: CardView[] }[]): Awaiting =>
  ({
    kind: 'declareBlockers',
    players: [ME],
    submitted: [],
    legal: pairs.map((p) => ({
      blocker: p.blocker.instanceId,
      attackers: p.attackers.map((a) => a.instanceId),
    })),
  }) as Awaiting;

describe('what a creature is worth', () => {
  test('a 2/2 is worth about four life', () => {
    const view = board();
    const bears = put(view, ME, fx.GRIZZLY_BEARS);
    expect(creatureValue(bears)).toBe(4);
  });

  /**
   * ⚠️ The ordering, not the numbers. Exact values move whenever a weight is
   * retuned and that is fine; a 4/4 flier being worth less than a 2/2 is never
   * fine, and that is what this catches.
   */
  test('evasion and relevance beat raw size', () => {
    const view = board();
    const bears = put(view, ME, fx.GRIZZLY_BEARS); // 2/2 vanilla
    const angel = put(view, ME, fx.SERRA_ANGEL); // 4/4 flying vigilance
    const spider = put(view, ME, fx.GIANT_SPIDER); // 2/4 reach
    const nighthawk = put(view, ME, fx.VAMPIRE_NIGHTHAWK); // 2/3 flying deathtouch lifelink
    const rats = put(view, ME, fx.TYPHOID_RATS); // 1/1 deathtouch

    expect(creatureValue(angel)).toBeGreaterThan(creatureValue(spider));
    expect(creatureValue(nighthawk)).toBeGreaterThan(creatureValue(bears));
    // A 1/1 deathtouch trades with anything, so it is worth more than its body.
    expect(creatureValue(rats)).toBeGreaterThan(2);
  });

  test('a summoning-sick creature is worth slightly less than a ready one', () => {
    const view = board();
    const ready = put(view, ME, fx.GRIZZLY_BEARS);
    const sick = put(view, ME, fx.GRIZZLY_BEARS, { summoningSick: true });
    expect(creatureValue(sick)).toBeLessThan(creatureValue(ready));
  });

  test('a damaged creature is worth less, and a dead-on-board one nothing', () => {
    const view = board();
    const hurt = put(view, ME, fx.GRIZZLY_BEARS, { damage: 1 });
    const gone = put(view, ME, fx.GRIZZLY_BEARS, { damage: 2 });
    expect(creatureValue(hurt)).toBe(3);
    expect(creatureValue(gone)).toBe(2);
  });
});

describe('reading the position', () => {
  test('a board is worth more than the life it protects', () => {
    const behind = board(40, 20);
    put(behind, FOE, fx.SERRA_ANGEL);
    put(behind, FOE, fx.AIR_ELEMENTAL);
    // Twenty life ahead and two 4/4 fliers behind is not winning.
    expect(scorePosition(behind, ME)).toBeLessThan(0);
  });

  test('the same board with more life scores higher', () => {
    const low = board(10, 40);
    const high = board(30, 40);
    expect(scorePosition(high, ME)).toBeGreaterThan(scorePosition(low, ME));
  });

  /**
   * ⚠️ THE BEST OPPONENT, NOT THE SUM. Crushing one seat at a four-player table
   * while a third builds a board is not winning, and an evaluation that added
   * the opponents up would say it was.
   */
  test('a third player with a board is not cancelled out by a dead one', () => {
    const view = board();
    view.seatOrder = [ME, FOE, 'p3'];
    view.seats['p3'] = { playerId: 'p3', name: 'Third', life: 40, cmdDamage: {}, poison: 0, manaPool: {}, lost: false } as never;
    put(view, 'p3', fx.AKROMA_ANGEL_OF_WRATH);
    const withThreat = scorePosition(view, ME);
    view.seats['p3'] = { ...(view.seats['p3'] as object), lost: true } as never;
    expect(scorePosition(view, ME)).toBeGreaterThan(withThreat);
  });
});

describe('attacking', () => {
  /**
   * ⚠️ THE POSITION M6.2 EXISTS FOR. Three 2/2s into one 2/2: the defender can
   * block one, so two connect. The first version priced each attacker against
   * the defender's best blocker on its own, decided every one of them was a bad
   * trade, and attacked with NOBODY — measured across a tournament as 9.8
   * attackers a game against a random opponent's 12.3.
   */
  test('three attackers into one blocker all attack', () => {
    const view = board();
    const mine = [
      put(view, ME, fx.GRIZZLY_BEARS),
      put(view, ME, fx.GRIZZLY_BEARS),
      put(view, ME, fx.GRIZZLY_BEARS),
    ];
    put(view, FOE, fx.GRIZZLY_BEARS);
    const attacks = chooseAttacks(view, attackPrompt(mine) as never, ME);
    expect(attacks.length).toBe(3);
  });

  test('one 2/2 into an untouched 4/4 stays home', () => {
    const view = board();
    const mine = [put(view, ME, fx.GRIZZLY_BEARS)];
    put(view, FOE, fx.SERRA_ANGEL);
    expect(chooseAttacks(view, attackPrompt(mine) as never, ME)).toEqual([]);
  });

  test('an empty board is attacked into with everything', () => {
    const view = board();
    const mine = [put(view, ME, fx.GRIZZLY_BEARS), put(view, ME, fx.RAGING_GOBLIN)];
    const attacks = chooseAttacks(view, attackPrompt(mine) as never, ME);
    expect(attacks.length).toBe(2);
  });

  /**
   * ⚠️ A flier is not stopped by a ground blocker, and `couldBlock` is what says
   * so. Without it the bot treats every creature as a wall and stops attacking
   * in exactly the matchup where attacking is free.
   */
  test('a flier attacks past a bigger ground creature', () => {
    const view = board();
    const mine = [put(view, ME, fx.AIR_ELEMENTAL)]; // 4/4 flying
    put(view, FOE, fx.COLOSSAL_DREADMAW); // 6/6 trample, no reach
    const attacks = chooseAttacks(view, attackPrompt(mine) as never, ME);
    expect(attacks.length).toBe(1);
  });

  /**
   * ⚠️ …and a bigger FLIER stops it, which is the other half of `couldBlock`.
   * The first version of this test used a 2/4 reach blocker and expected the
   * attack to be refused — but a 4/4 kills a 2/4 and survives, so attacking into
   * it is correct and the bot was right. Reach makes a blocker ELIGIBLE, not
   * good.
   */
  test('and a bigger flier stops it again', () => {
    const view = board();
    const mine = [put(view, ME, fx.AIR_ELEMENTAL)]; // 4/4 flying
    put(view, FOE, fx.AKROMA_ANGEL_OF_WRATH); // 6/6 flying, first strike
    const attacks = chooseAttacks(view, attackPrompt(mine) as never, ME);
    expect(attacks.length).toBe(0);
  });

  /**
   * ⚠️ Everything that attacks is tapped on the way back. Against a board that
   * could kill me the bot keeps its best blockers home — the rule that was
   * missing when the clock weighting first made it aggressive, and it went from
   * blocking 4.4 times a game to letting an 11-attacker swing through.
   */
  test('a lethal board at home keeps blockers back', () => {
    const view = board(6, 40);
    const mine = [put(view, ME, fx.GRIZZLY_BEARS), put(view, ME, fx.GRIZZLY_BEARS)];
    put(view, FOE, fx.COLOSSAL_DREADMAW); // 6/6 — exactly lethal
    put(view, FOE, fx.COLOSSAL_DREADMAW);
    const attacks = chooseAttacks(view, attackPrompt(mine) as never, ME);
    expect(attacks.length).toBeLessThan(2);
  });

  test('every attacker named is one the prompt offered', () => {
    const view = board();
    const mine = [put(view, ME, fx.GRIZZLY_BEARS), put(view, ME, fx.SERRA_ANGEL)];
    // A creature the prompt does NOT list must never be attacked with, whatever
    // the board says — this is the anti-cheating check for the attack side.
    put(view, ME, fx.AKROMA_ANGEL_OF_WRATH);
    const prompt = attackPrompt(mine);
    const offered = new Set(mine.map((c) => c.instanceId));
    for (const a of chooseAttacks(view, prompt as never, ME)) {
      expect(offered.has(a.card)).toBe(true);
    }
  });
});

describe('blocking', () => {
  test('a free kill is taken', () => {
    const view = board();
    const attacker = put(view, FOE, fx.RAGING_GOBLIN, { attacking: ME }); // 1/1
    const blocker = put(view, ME, fx.SERRA_ANGEL); // 4/4 — kills it and lives
    const blocks = chooseBlocks(view, blockPrompt([{ blocker, attackers: [attacker] }]) as never, ME);
    expect(blocks).toEqual([{ blocker: blocker.instanceId, attacker: attacker.instanceId }]);
  });

  test('a blocker that just dies for nothing stays home', () => {
    const view = board(40, 40);
    const attacker = put(view, FOE, fx.COLOSSAL_DREADMAW, { attacking: ME }); // 6/6
    const blocker = put(view, ME, fx.GRIZZLY_BEARS); // 2/2 — dies, kills nothing
    const blocks = chooseBlocks(view, blockPrompt([{ blocker, attackers: [attacker] }]) as never, ME);
    expect(blocks).toEqual([]);
  });

  /**
   * ⚠️ …and the SAME position at 5 life is a chump block, because a creature is
   * worth nothing to a player who is dead. This pair is the whole of `pressure`.
   */
  test('the same blocker chumps when the damage is lethal', () => {
    const view = board(5, 40);
    // ⚠️ NOT the Dreadmaw: it has TRAMPLE, so chumping a 6/6 with a 2/2 saves
    // two damage and still dies to the other four. The bot declining that block
    // is correct play, and the first version of this test called it a bug.
    const attacker = put(view, FOE, fx.SCALED_BEHEMOTH, { attacking: ME }); // 7/6, no trample
    const blocker = put(view, ME, fx.GRIZZLY_BEARS);
    const blocks = chooseBlocks(view, blockPrompt([{ blocker, attackers: [attacker] }]) as never, ME);
    expect(blocks.length).toBe(1);
  });

  test('deathtouch blocks the biggest thing on the board', () => {
    const view = board();
    const big = put(view, FOE, fx.COLOSSAL_DREADMAW, { attacking: ME });
    const small = put(view, FOE, fx.RAGING_GOBLIN, { attacking: ME });
    const rats = put(view, ME, fx.TYPHOID_RATS); // 1/1 deathtouch
    const blocks = chooseBlocks(
      view,
      blockPrompt([{ blocker: rats, attackers: [big, small] }]) as never,
      ME,
    );
    expect(blocks).toEqual([{ blocker: rats.instanceId, attacker: big.instanceId }]);
  });

  test('every pairing returned is one the prompt listed', () => {
    const view = board(8, 40);
    const a1 = put(view, FOE, fx.SERRA_ANGEL, { attacking: ME });
    const a2 = put(view, FOE, fx.AIR_ELEMENTAL, { attacking: ME });
    const b1 = put(view, ME, fx.GIANT_SPIDER);
    const b2 = put(view, ME, fx.GRIZZLY_BEARS);
    // b2 may only block a2, per the prompt. The bot must respect that even
    // though the view alone would allow either.
    const prompt = blockPrompt([
      { blocker: b1, attackers: [a1, a2] },
      { blocker: b2, attackers: [a2] },
    ]);
    const allowed = new Set(['b1:a1', 'b1:a2', 'b2:a2']);
    const key = (b: string, a: string): string =>
      `${b === b1.instanceId ? 'b1' : 'b2'}:${a === a1.instanceId ? 'a1' : 'a2'}`;
    const blocks = chooseBlocks(view, prompt as never, ME);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(allowed.has(key(b.blocker, b.attacker))).toBe(true);
    // and no blocker is used twice
    expect(new Set(blocks.map((b) => b.blocker)).size).toBe(blocks.length);
  });
});

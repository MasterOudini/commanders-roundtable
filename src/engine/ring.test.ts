// D521 - THE RING TEMPTS YOU (CR 701.54). `The Ring tempts you.` (Birthday Escape's `Draw a card. The Ring tempts you.`,
// Claim the Precious's `Destroy target creature. The Ring tempts you.`, an enters or dies payload) - the caster chooses a
// creature they control as their Ring-bearer (the queue's eighth verb: the candidates are every creature they control,
// several are asked with `pick: 'ringBearer'` - a printed rule, never ids -, the only one goes unasked, none still
// counts), the seat's count rises and the Ring emblem arrives in the command zone with the first temptation; the
// emblem's abilities unlock on the count - the bearer is legendary and can't be blocked by creatures with greater power
// (1), its attack loots (2), a creature blocking it is sacrificed at end of combat (3), its combat damage to a player
// makes each opponent lose 3 life (4). What is proven here: the readings (the payload and the `Then` form; the emblem's
// own lines), the pool (the emblem printing every tempting card asks for), the temptation with no creature (counted,
// no bearer, the emblem once), the forced bearer and its supertype, the tie asked and a foe's creature refused, the
// evasion at level 1 and the loot at level 2, the blocker's sacrifice at level 3 and the drain at level 4, a bearer that
// leaves (the seat's pointer cleared), a repeat that moves the Ring to another creature; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { BIRTHDAY_ESCAPE, CLAIM_THE_PRECIOUS } from '../data/fixtures/engineCards';
import { RING_EMBLEM, tokenPrintingIdsIn } from '../data/tokenParse';
import { canBlock } from './combat';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { THE_RING_SCRIPT } from './scripts/cards/theRing';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const at = { kind: 'player', id: 'p2' } as const;
// The emblem's three triggers are its script's (the shipped registry carries it); a harness game names its registry.
const RING = createRegistry([THE_RING_SCRIPT]);
/** The loot and the hand-size cleanup must not be confused: the hand is trimmed to four before combat. */
const trimHand = (g: Game) => { for (const c of (g.state.zones.hand.p1 ?? []).slice(4)) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: c, to: { kind: 'library', player: 'p1' }, placement: 'bottom' })); };
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const castNoTarget = (g: Game, who: 'p1' | 'p2', name: string, symbols: string): InstanceId => {
  const card = put(g, who, name, 'hand');
  mana(g, who, symbols);
  must(g.submit({ t: 'CastSpell', player: who, card, targets: [] }));
  return card;
};
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, kinds: p.effects.map((e) => e.kind) }; };
const seat = (g: Game, who: 'p1' | 'p2') => g.state.players[who] as NonNullable<Game['state']['players']['p1']>;
const tempts = (g: Game) => g.log.filter((e) => e.body.t === 'RingTempted').length;
const emblemsOf = (g: Game, who: 'p1' | 'p2') => (g.state.zones.command[who] ?? []).filter((id) => g.state.cards[id]?.printingId === RING_EMBLEM.printingId);
const legendary = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id).typeLine.supertypes.includes('Legendary');
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const hand = (g: Game, who: 'p1' | 'p2') => (g.state.zones.hand[who] ?? []).length;
/** The tie's answer, when the temptation raised one; nothing otherwise. */
const bear = (g: Game, choice: InstanceId) => {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
  const ask = g.state.priority.awaiting;
  if (ask?.kind === 'chooseFromZone' && ask.pick === 'ringBearer') must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [choice] }));
  settle(g);
};
const toAttack = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 60_000);

describe('D521 - the Ring tempts you', () => {
  test("the readings: the payload, its Then form, a spell's last sentence; the emblem's own lines", () => {
    expect(kinds('The Ring tempts you.')).toEqual({ mode: 'auto', kinds: ['ringTempt'] });
    expect(kinds('Draw a card. The Ring tempts you.')).toEqual({ mode: 'auto', kinds: ['draw', 'ringTempt'] });
    expect(kinds('Destroy target creature. The Ring tempts you.')).toEqual({ mode: 'auto', kinds: ['destroy', 'ringTempt'] });
    expect(kinds('Return target creature card from your graveyard to your hand. Then the Ring tempts you.').mode).toBe('auto');
    expect(kinds('Draw a card, then discard a card.')).toEqual({ mode: 'auto', kinds: ['draw', 'discard'] });
    expect(kinds('Each opponent loses 3 life.')).toEqual({ mode: 'auto', kinds: ['loseLife'] });
  });

  test('the pool carries the Ring emblem for every card the Ring tempts', () => {
    expect(tokenPrintingIdsIn([BIRTHDAY_ESCAPE])).toContain(RING_EMBLEM.printingId);
    expect(tokenPrintingIdsIn([CLAIM_THE_PRECIOUS])).toContain(RING_EMBLEM.printingId);
  });

  test('Birthday Escape with no creature: tempted and counted, no bearer, the emblem once; a second temptation counts again; the replay hash', () => {
    const g = startedGame({ players: 2, scripts: RING, decks: [['Birthday Escape', 'Birthday Escape'], ['Grizzly Bears']] });
    holdEverywhere(g);
    main(g, 3);
    const hand0 = hand(g, 'p1');
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    settle(g);
    expect(g.state.priority.awaiting, 'no creature: nothing to choose').toBeNull();
    expect(seat(g, 'p1').ringTempts).toBe(1);
    expect(seat(g, 'p1').ringBearer).toBeNull();
    expect(emblemsOf(g, 'p1'), 'the Ring in the command zone').toHaveLength(1);
    expect(nameOf(g, emblemsOf(g, 'p1')[0] as InstanceId)).toMatch(/^The Ring/);
    expect(hand(g, 'p1'), 'the draw, minus the spell cast').toBe(hand0);
    expect(tempts(g)).toBe(1);
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    settle(g);
    expect(seat(g, 'p1').ringTempts).toBe(2);
    expect(emblemsOf(g, 'p1'), 'one Ring, ever').toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'Narrated' && /The Ring tempts .* no creature to bear it/.test(e.body.text)), 'said').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('one creature: the bearer goes unasked and is legendary; a leave clears the seat; two creatures: the tie is asked, a foe refused; the replay hash', () => {
    const g = startedGame({ players: 2, scripts: RING, decks: [['Birthday Escape', 'Birthday Escape', 'Birthday Escape', 'Grizzly Bears', 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const foe = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    main(g, 3);
    expect(legendary(g, bears)).toBe(false);
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    settle(g);
    expect(g.state.priority.awaiting, 'one candidate: no question').toBeNull();
    expect(seat(g, 'p1').ringBearer).toBe(bears);
    expect(seat(g, 'p1').ringTempts).toBe(1);
    expect(legendary(g, bears), 'the Ring-bearer is legendary').toBe(true);
    expect(legendary(g, foe)).toBe(false);
    // The bearer leaves: the seat's pointer is cleared, the count stays.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    expect(seat(g, 'p1').ringBearer, 'a bearer that left is no bearer').toBeNull();
    expect(seat(g, 'p1').ringTempts).toBe(1);
    const bears2 = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const angel = put(g, 'p1', 'Serra Angel', 'battlefield');
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.player).toBe('p1');
    expect(ask.zone).toBe('battlefield');
    expect(ask.count).toBe(1);
    expect(ask.pick, 'the prompt names the rule, not the candidates').toBe('ringBearer');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [foe] }).ok, "a foe's creature is no candidate").toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [angel] }));
    settle(g);
    expect(seat(g, 'p1').ringBearer).toBe(angel);
    expect(seat(g, 'p1').ringTempts).toBe(2);
    expect(legendary(g, angel)).toBe(true);
    expect(legendary(g, bears2)).toBe(false);
    // A third temptation moves the Ring: the Bears is chosen, the Angel is no longer the bearer.
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    bear(g, bears2);
    expect(seat(g, 'p1').ringBearer).toBe(bears2);
    expect(legendary(g, angel), 'the Ring moved on').toBe(false);
    expect(legendary(g, bears2)).toBe(true);
    expect(emblemsOf(g, 'p1')).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('levels 1 and 2: the bearer cannot be blocked by a creature with greater power, and its attack loots; the replay hash', () => {
    const g = startedGame({ players: 2, scripts: RING, decks: [['Birthday Escape', 'Birthday Escape', 'Grizzly Bears'], ['Serra Angel', 'Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const angel = put(g, 'p2', 'Serra Angel', 'battlefield');
    const foeBears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    main(g, 3);
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    settle(g);
    castNoTarget(g, 'p1', 'Birthday Escape', 'U');
    settle(g);
    expect(seat(g, 'p1').ringTempts).toBe(2);
    expect(seat(g, 'p1').ringBearer).toBe(bears);
    trimHand(g);
    toAttack(g, 3);
    const handBefore = hand(g, 'p1');
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: at }] }));
    // Level 2: the loot goes on the stack - a card drawn, then one discarded (the discard asks).
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.zone === 'hand', 20_000);
    const loot = g.state.priority.awaiting;
    if (loot?.kind !== 'chooseFromZone') throw new Error('no discard ask');
    expect(hand(g, 'p1'), 'the card drawn first').toBe(handBefore + 1);
    const discard = (g.state.zones.hand.p1 ?? [])[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [discard] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(hand(g, 'p1'), 'then one discarded').toBe(handBefore);
    // Level 1: the Angel (4 power against 2) may not block the bearer; the foe's Bears may.
    expect(canBlock({ state: g.state, oracle: g.deps.oracle, scripts: g.deps.scripts }, angel, bears)).toBe('ringBearer');
    expect(canBlock({ state: g.state, oracle: g.deps.oracle, scripts: g.deps.scripts }, foeBears, bears)).toBeNull();
    expect(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: angel, attacker: bears }] }).ok, 'the Angel is refused').toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(life(g, 'p2'), 'unblocked: two damage, no drain at level 2').toBe(38);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("levels 3 and 4: a blocker is sacrificed at end of combat; unblocked combat damage drains each opponent 3; the replay hash", () => {
    const g = startedGame({ players: 2, scripts: RING, decks: [['Birthday Escape', 'Birthday Escape', 'Birthday Escape', 'Birthday Escape', 'Grizzly Bears'], ['Straw Soldiers']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    // A 1/3 blocker: it survives the bearer's two, the bearer survives its one - what ends it is the Ring's sacrifice.
    const wall = put(g, 'p2', 'Straw Soldiers', 'battlefield');
    main(g, 3);
    for (let i = 0; i < 4; i++) { castNoTarget(g, 'p1', 'Birthday Escape', 'U'); settle(g); }
    expect(seat(g, 'p1').ringTempts).toBe(4);
    expect(seat(g, 'p1').ringBearer).toBe(bears);
    trimHand(g);
    toAttack(g, 3);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: at }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.zone === 'hand', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [(g.state.zones.hand.p1 ?? [])[0] as InstanceId] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    // Level 3: the wall blocks (a lesser power - allowed) and is sacrificed at end of combat; both survive the damage.
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: wall, attacker: bears }] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(g.state.cards[wall]?.zone.kind, 'sacrificed at end of combat').toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind, 'the bearer stands').toBe('battlefield');
    expect(g.log.some((e) => e.body.t === 'Narrated' && /sacrifices it at end of combat/.test(e.body.text)), 'the delayed sacrifice, said').toBe(true);
    expect(life(g, 'p2'), 'blocked: no damage to the player').toBe(40);
    // Level 4: the next attack is unblocked - two damage and the drain.
    toAttack(g, 5);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: at }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.zone === 'hand', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [(g.state.zones.hand.p1 ?? [])[0] as InstanceId] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 6, 40_000);
    expect(life(g, 'p2'), 'two combat damage and three lost').toBe(35);
    expect(life(g, 'p1')).toBe(40);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

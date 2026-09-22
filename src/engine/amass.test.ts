// D520 - AMASS [SUBTYPE] N (CR 701.47). `Amass Zombies 3.` (Relentless Advance), `Create a Treasure token. Amass Orcs 2.`
// (Swarming of Moria), `When this creature enters, amass Zombies 1.` (Lazotep Reaver) - if you control no Army creature
// token, create a 0/0 black [subtype] Army creature token; choose an Army creature token you control; put N +1/+1 counters
// on it; it becomes the subtype in addition to its other types - is the queue's seventh verb: the candidates are computed
// (`armyTokens`), the Army is made first when none is held, several are asked of the caster (the prompt says `pick: 'army'`
// - a printed rule, never ids), the only one goes unasked. What is proven here: the readings (the count and the table's
// Army; `Amass Goblins` - no such Army printed -, `Amass X` and the `, then` form left unread); the pool carries the Army
// the keyword makes (D133's rule - a created token the pool lacks is a blank); Relentless Advance with no Army - a Zombie
// Army 0/0 made and grown to 3/3 unasked, a second growing it to 6/6 (no second token), then Swarming of Moria growing it
// to 8/8 past the Treasure it made first AND making it an Orc (once - a Zombie stays a Zombie); Swarming of Moria with no
// Army - an Orc Army, no subtype added; two Zombie Armies - the tie asked, a Bears refused, the chosen one grown and the
// other not, no token made; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { RELENTLESS_ADVANCE, SWARMING_OF_MORIA, ORC_ARMY_TOKEN, ZOMBIE_ARMY_TOKEN } from '../data/fixtures/engineCards';
import { tokenPrintingIdsIn } from '../data/tokenParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const cast = (g: Game, who: 'p1' | 'p2', name: string, symbols: string): InstanceId => {
  const card = put(g, who, name, 'hand');
  mana(g, who, symbols);
  must(g.submit({ t: 'CastSpell', player: who, card, targets: [] }));
  settle(g);
  return card;
};
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, amount: e.amount, subtype: e.subtype, token: e.token?.name })) }; };
const plus = (g: Game, id: string) => g.state.cards[id]?.counters['+1/+1'] ?? 0;
const amasses = (g: Game) => g.log.filter((e) => e.body.t === 'Amassed').length;
const tokensMade = (g: Game) => g.log.filter((e) => e.body.t === 'TokenCreated').length;
const becameEvents = (g: Game) => g.log.filter((e) => e.body.t === 'CreatureSubtypeAdded').length;
const said = (g: Game, re: RegExp) => g.log.some((e) => e.body.t === 'Narrated' && re.test(e.body.text));
const subtypesOf = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id).typeLine.subtypes;
const ptOf = (g: Game, id: InstanceId) => { const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return `${d.power}/${d.toughness}`; };
const armiesOf = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === who && g.state.cards[id]?.isToken === true && subtypesOf(g, id).includes('Army'));

describe('D520 - amass', () => {
  test("the readings: the count and the table's Army; Amass Goblins, Amass X and the then form stay unread", () => {
    expect(kinds('Amass Zombies 3.')).toEqual({ mode: 'auto', effects: [{ kind: 'amass', amount: 3, subtype: 'Zombie', token: 'Zombie Army' }] });
    expect(kinds('Amass Orcs 1.')).toEqual({ mode: 'auto', effects: [{ kind: 'amass', amount: 1, subtype: 'Orc', token: 'Orc Army' }] });
    expect(kinds('Amass Slivers 2.')).toEqual({ mode: 'auto', effects: [{ kind: 'amass', amount: 2, subtype: 'Sliver', token: 'Sliver Army' }] });
    expect(kinds('Create a Treasure token. Amass Orcs 2.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken', amount: 1 }, { kind: 'amass', amount: 2, subtype: 'Orc' }] });
    expect(kinds('Amass Goblins 2.').mode, 'no Goblin Army is printed').not.toBe('auto');
    expect(kinds('Amass Zombies X, where X is the number of cards in your hand.').mode).not.toBe('auto');
    expect(kinds("Amass Orcs 3, then target player mills X cards, where X is the amassed Army's power.").mode).not.toBe('auto');
  });

  test('the pool carries the Army the keyword makes', () => {
    expect(tokenPrintingIdsIn([RELENTLESS_ADVANCE])).toContain(ZOMBIE_ARMY_TOKEN.scryfallId);
    expect(tokenPrintingIdsIn([RELENTLESS_ADVANCE])).not.toContain(ORC_ARMY_TOKEN.scryfallId);
    expect(tokenPrintingIdsIn([SWARMING_OF_MORIA])).toContain(ORC_ARMY_TOKEN.scryfallId);
  });

  test('Relentless Advance with no Army: a Zombie Army made and grown unasked; a second grows it; Swarming of Moria grows it past its Treasure and makes it an Orc too; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Relentless Advance', 'Relentless Advance', 'Swarming of Moria', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    put(g, 'p2', 'Grizzly Bears', 'battlefield');
    main(g, 3);
    const spell = cast(g, 'p1', 'Relentless Advance', 'UUUU');
    expect(g.state.priority.awaiting, 'no Army held: the one made is the one candidate, unasked').toBeNull();
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    const armies = armiesOf(g, 'p1');
    expect(armies, 'one Army made').toHaveLength(1);
    const army = armies[0] as InstanceId;
    expect(nameOf(g, army)).toBe('Zombie Army');
    expect(g.state.cards[army]?.isToken).toBe(true);
    expect(plus(g, army)).toBe(3);
    expect(ptOf(g, army), 'a 0/0 grown by its counters').toBe('3/3');
    expect(subtypesOf(g, army)).toEqual(['Zombie', 'Army']);
    expect(becameEvents(g), 'a Zombie stays a Zombie').toBe(0);
    expect(amasses(g)).toBe(1);
    expect(tokensMade(g)).toBe(1);
    expect(said(g, /amasses Zombies 3: Zombie Army gets 3 \+1\/\+1 counters\./), 'said').toBe(true);

    cast(g, 'p1', 'Relentless Advance', 'UUUU');
    expect(armiesOf(g, 'p1'), 'no second Army: the held one grows').toHaveLength(1);
    expect(plus(g, army)).toBe(6);
    expect(tokensMade(g)).toBe(1);
    expect(amasses(g)).toBe(2);

    cast(g, 'p1', 'Swarming of Moria', 'RRR');
    expect(armiesOf(g, 'p1'), 'the Treasure made first is no Army').toHaveLength(1);
    expect(tokensMade(g), 'the Treasure').toBe(2);
    expect(plus(g, army)).toBe(8);
    expect(ptOf(g, army)).toBe('8/8');
    expect(subtypesOf(g, army), 'an Orc in addition to its other types').toEqual(['Zombie', 'Army', 'Orc']);
    expect(becameEvents(g)).toBe(1);
    expect(said(g, /amasses Orcs 2: Zombie Army gets 2 \+1\/\+1 counters and is an Orc too\./), 'the subtype said').toBe(true);
    expect(amasses(g)).toBe(3);
    expect(g.state.priority.awaiting).toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Swarming of Moria with no Army: an Orc Army made beside the Treasure, no subtype added; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Swarming of Moria'], ['Grizzly Bears']] });
    holdEverywhere(g);
    main(g, 3);
    cast(g, 'p1', 'Swarming of Moria', 'RRR');
    const armies = armiesOf(g, 'p1');
    expect(armies).toHaveLength(1);
    const army = armies[0] as InstanceId;
    expect(nameOf(g, army)).toBe('Orc Army');
    expect(plus(g, army)).toBe(2);
    expect(ptOf(g, army)).toBe('2/2');
    expect(subtypesOf(g, army)).toEqual(['Orc', 'Army']);
    expect(becameEvents(g)).toBe(0);
    expect(tokensMade(g), 'the Treasure and the Army').toBe(2);
    expect(amasses(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two Zombie Armies: the tie is asked, the Bears refused, the chosen Army grows and no token is made; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Relentless Advance', 'Relentless Advance', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    main(g, 3);
    cast(g, 'p1', 'Relentless Advance', 'UUUU');
    const a = armiesOf(g, 'p1')[0] as InstanceId;
    expect(a).toBeDefined();
    // A second Army the rules never make on their own (a 0/0 the state-based check would bin before any counter could be
    // put by hand): created with its counters in ONE batch, as a copy effect would leave it.
    const b = `c${g.state.counters.instance + 1}` as InstanceId;
    g.emit([
      { t: 'TokenCreated', card: b, oracleId: ZOMBIE_ARMY_TOKEN.oracleId, printingId: ZOMBIE_ARMY_TOKEN.scryfallId, controller: 'p1', owner: 'p1', turnNumber: g.state.turn.turnNumber },
      { t: 'CountersChanged', changes: [{ card: b, kind: '+1/+1', delta: 2 }] },
    ]);
    expect(armiesOf(g, 'p1')).toHaveLength(2);
    const spell = put(g, 'p1', 'Relentless Advance', 'hand');
    mana(g, 'p1', 'UUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.player).toBe('p1');
    expect(ask.zone).toBe('battlefield');
    expect(ask.count).toBe(1);
    expect(ask.pick, 'the prompt names the rule, not the candidates').toBe('army');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }).ok, 'the Bears is no Army').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [b] }));
    settle(g);
    expect(plus(g, b)).toBe(5);
    expect(plus(g, a)).toBe(3);
    expect(plus(g, bears)).toBe(0);
    expect(armiesOf(g, 'p1'), 'no third Army').toHaveLength(2);
    expect(tokensMade(g), 'the first amass made one, the batch one, the second amass none').toBe(2);
    expect(amasses(g)).toBe(2);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

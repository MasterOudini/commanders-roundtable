// D622 - MILL, THEN A PICK FROM AMONG THE MILLED CARDS. `Mill N cards. You may put a <noun> card from among them into your
// hand.` and its kin (`from among the cards milled this way` / `the milled cards` / `those cards`, `<noun> card milled this
// way`, `onto the battlefield`, the mandatory `Put ...`, `Put up to one ...`) read as ONE clause - `millPick`: the top N of
// the caster's library into the graveyard (CR 701.13), then, when the noun admits any of the milled cards, the caster
// chooses from among them (a PUBLIC pool - a graveyard is public, CR 404.2) and the picks go where the line sends them; the
// rest stay in the graveyard. What is proven: the readings and a refusal; the optional pick asked over the admitted milled
// cards only (a pick outside them refused, a pick taken); a decline, with the clause after the pick waiting for the answer;
// the mandatory pick asking even over one admitted card (the replacement funnel decides where the milled cards land, after
// the executor - only the answer reads it) and refusing a decline; nothing admitted, nothing asked; the battlefield pick;
// the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { faceOf } from './oracle';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const toPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 400);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const nameOf = (g: Game, id: InstanceId) => { const inst = g.state.cards[id]; const p = inst ? ORACLE.byPrinting(inst.printingId) : undefined; return p ? faceOf(p, inst?.faceIndex ?? 0).name : '?'; };
/** The named cards staged on top in the given order (the last named ends on top), each a DIFFERENT card of p1's. */
const stage = (g: Game, names: readonly string[]): InstanceId[] => {
  const used: InstanceId[] = [];
  for (const n of names) {
    const id = (Object.keys(g.state.cards) as InstanceId[]).find((c) => !used.includes(c) && nameOf(g, c) === n && (g.state.cards[c]?.zone.kind === 'library' || g.state.cards[c]?.zone.kind === 'hand') && g.state.cards[c]?.zone.player === 'p1');
    if (!id) throw new Error(n + ' is not in the library or the hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    used.push(id);
  }
  return used;
};
const spec = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, kinds: p.effects.map((e) => e.kind), amount: p.effects[0]?.amount, look: p.effects[0]?.look ?? null }; };
const HOST = 'Elvish Rejuvenator';
/** An enters trigger on the host whose payload is the printed mill sentence(s). */
function entersMill(printed: string): CardScript {
  const card = ORACLE.byName(HOST);
  if (!card) throw new Error(HOST + ' is not in the fixtures');
  const effects = vocabularyEffects(printed, HOST);
  const targets = vocabularyTargets(printed);
  return {
    oracleId: card.oracleId, name: HOST,
    triggers: [{
      abilityId: 'etb-0', text: card.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => HOST + ' - mill',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
/** The host cast on turn 3 with the named cards staged on top; returns the game and the staged ids (top last). */
function fire(printed: string, top: readonly string[]): { g: Game; staged: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[HOST, 'Grizzly Bears', 'Lightning Bolt', 'Divination'], ['Grizzly Bears']], scripts: createRegistry([entersMill(printed)]) });
  holdEverywhere(g);
  const host = put(g, 'p1', HOST, 'hand');
  main(g, 3);
  const staged = stage(g, top);
  mana(g, 'GGG');
  must(g.submit({ t: 'CastSpell', player: 'p1', card: host, targets: [] }));
  return { g, staged };
}
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;

describe('D622 - mill, then a pick from among the milled cards', () => {
  test('the readings: each take form builds one millPick; the plain mill untouched; a noun outside the reader refused', () => {
    expect(spec('Mill three cards. You may put a creature card from among them into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], amount: 3, look: { take: 1, optional: true, rest: 'graveyard', filter: { what: 'creature card' } } });
    expect(spec('Mill five cards. You may put a permanent card from among the cards milled this way into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], amount: 5, look: { optional: true, filter: { what: 'permanent card' } } });
    expect(spec('Mill four cards. Put a land card from among the milled cards into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], amount: 4, look: { optional: false } });
    expect(spec('Mill seven cards. Then put a creature card from among them onto the battlefield.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], amount: 7, look: { optional: false, to: 'battlefield' } });
    expect(spec('Mill five cards. Put up to one enchantment card milled this way into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], look: { optional: true } });
    expect(spec('Mill a card. You may put an instant or sorcery card milled this way into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], amount: 1 });
    expect(spec('Mill three cards. You may put a noncreature, nonland card from among the cards milled this way into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'], look: { none: ['Creature', 'Land'] } });
    expect(spec('Mill four cards. You may put an artifact creature card or Vehicle card from among the cards milled this way into your hand.')).toMatchObject({ mode: 'auto', kinds: ['millPick'] });
    expect(spec('Mill three cards.')).toMatchObject({ mode: 'auto', kinds: ['mill'], look: null });
    // The clause after the pick reads on its own (it waits for the answer - the continuation).
    expect(parseEffects('Mill two cards. You may put a permanent card from among the milled cards into your hand. You gain 2 life.', '~', true).effects.map((e) => e.kind)).toEqual(['millPick', 'gainLife']);
    // A noun the reader cannot place refuses the pick: the line does not read whole.
    expect(spec('Mill three cards. You may put a historic card from among them into your hand.').mode).not.toBe('auto');
  });

  test('the optional pick: asked over the admitted milled cards only; a card outside them refused; the pick to the hand; the replay hash', () => {
    const { g, staged } = fire('Mill three cards. You may put a creature card from among them into your hand.', ['Lightning Bolt', 'Grizzly Bears', 'Forest']);
    toPrompt(g);
    const [bolt, bears, forest] = staged as [InstanceId, InstanceId, InstanceId];
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', player: 'p1', zone: 'graveyard', count: 1, min: 0, rest: null, pool: [bears] });
    for (const id of staged) expect(zoneOf(g, id), nameOf(g, id) + ' milled').toBe('graveyard');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }).ok, 'a land is not a creature card').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(zoneOf(g, bears)).toBe('hand');
    expect(zoneOf(g, bolt)).toBe('graveyard');
    expect(zoneOf(g, forest)).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a decline keeps every milled card in the graveyard, and the clause after the pick waits for the answer', () => {
    const { g, staged } = fire('Mill two cards. You may put a permanent card from among the milled cards into your hand. You gain 2 life.', ['Grizzly Bears', 'Forest']);
    toPrompt(g);
    const life = g.state.players['p1']?.life ?? 0;
    expect(g.state.priority.awaiting).toMatchObject({ zone: 'graveyard', min: 0, count: 1 });
    expect([...((g.state.priority.awaiting as { pool?: readonly InstanceId[] }).pool ?? [])].sort()).toEqual([...staged].sort());
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    for (const id of staged) expect(zoneOf(g, id)).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(life + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the mandatory pick asks even over one admitted card, and refuses a decline; over two it asks which', () => {
    const one = fire('Mill three cards. Put a land card from among the milled cards into your hand.', ['Lightning Bolt', 'Forest', 'Divination']);
    toPrompt(one.g);
    const [bolt, forest, div] = one.staged as [InstanceId, InstanceId, InstanceId];
    expect(one.g.state.priority.awaiting).toMatchObject({ zone: 'graveyard', min: 1, count: 1, pool: [forest] });
    expect(one.g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }).ok, 'the pick is mandatory').toBe(false);
    must(one.g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(one.g);
    expect(zoneOf(one.g, forest)).toBe('hand');
    expect(zoneOf(one.g, bolt)).toBe('graveyard');
    expect(zoneOf(one.g, div)).toBe('graveyard');
    const two = fire('Mill three cards. Put a land card from among the milled cards into your hand.', ['Forest', 'Lightning Bolt', 'Forest']);
    toPrompt(two.g);
    const [f1, , f2] = two.staged as [InstanceId, InstanceId, InstanceId];
    expect(two.g.state.priority.awaiting).toMatchObject({ zone: 'graveyard', min: 1, count: 1 });
    expect([...((two.g.state.priority.awaiting as { pool?: readonly InstanceId[] }).pool ?? [])].sort()).toEqual([f1, f2].sort());
    must(two.g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [f2] }));
    settle(two.g);
    expect(zoneOf(two.g, f2)).toBe('hand');
    expect(zoneOf(two.g, f1)).toBe('graveyard');
    expect(stateHash(replay(two.g.log, two.g.seed))).toBe(two.g.hash());
  });

  test('nothing admitted asks nothing; the battlefield pick puts the creature onto the battlefield', () => {
    const none = fire('Mill three cards. You may put a creature card from among them into your hand.', ['Forest', 'Lightning Bolt', 'Divination']);
    settle(none.g);
    for (const id of none.staged) expect(zoneOf(none.g, id)).toBe('graveyard');
    expect(none.g.log.some((ev) => ev.body.t === 'AwaitingSet' && ev.body.awaiting?.kind === 'chooseFromZone' && ev.body.awaiting.zone === 'graveyard'), 'nothing asked').toBe(false);
    const bf = fire('Mill three cards. Then put a creature card from among them onto the battlefield.', ['Forest', 'Grizzly Bears', 'Lightning Bolt']);
    toPrompt(bf.g);
    const bears = bf.staged[1] as InstanceId;
    expect(bf.g.state.priority.awaiting).toMatchObject({ zone: 'graveyard', to: 'battlefield', min: 1, count: 1, pool: [bears] });
    must(bf.g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(bf.g);
    expect(zoneOf(bf.g, bears)).toBe('battlefield');
    expect(bf.g.state.cards[bears]?.controller).toBe('p1');
    expect(stateHash(replay(bf.g.log, bf.g.seed))).toBe(bf.g.hash());
  });
});

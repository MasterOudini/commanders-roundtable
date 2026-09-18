// D493 - THE LOOK GRAMMAR. `Look at / Reveal the top N cards of your library. <take>. <rest>.` read as one grammar over
// the pieces the family prints (433 leftover lines in 288 shapes): a TAKE (a filtered optional pick to the hand or the
// battlefield - tapped when the line says so -, a mandatory filtered pick, `N of them`, and the one-card `if it's a
// <noun> card, ...`) and a REST (the bottom in a random order / any order, the graveyard, the inline forms, the
// one-card `Otherwise`, or nothing - the leftovers stay). A reveal is the same look made public; a negated noun
// (`noncreature, nonland`) is the hand reveal's `none`. What is proven here: the readings (each form's spec) and the
// refusals (a trailing sentence, a noun outside the reader, a one-card form over N cards); a pick onto the battlefield
// tapped with the rest bottomed at random; a reveal seen by every seat with the rest into the graveyard; the one-card
// mandatory look sending a land to the battlefield and a spell to the hand with no question asked; a mandatory
// filtered pick over a run that admits nothing; the negated noun refusing a creature; the replay hash on each.
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
const onTop = (g: Game, names: readonly string[]) => {
  // The named cards, staged on top in the given order (the last named ends on top).
  for (const n of names) {
    const id = (Object.keys(g.state.cards) as InstanceId[]).find((c) => nameOf(g, c) === n && (g.state.cards[c]?.zone.kind === 'library' || g.state.cards[c]?.zone.kind === 'hand') && g.state.cards[c]?.zone.player === 'p1');
    if (!id) throw new Error(n + ' is not in the library or the hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
  }
};
const lookSpec = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, kinds: p.effects.map((e) => e.kind), look: p.effects[0]?.look ?? null }; };
/** An enters trigger on a fixture whose payload is the printed look sentence(s). */
function entersLook(name: string, printed?: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const line = (card.faces[0]?.oracleText ?? '').split(String.fromCharCode(10)).find((l) => l.startsWith('When this creature enters, ')) ?? '';
  const payload = printed ?? line.replace(/^When this creature enters, /, '');
  const effects = vocabularyEffects(payload.charAt(0).toUpperCase() + payload.slice(1), name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'etb-0', text: card.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => name + ' - look',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D493 - the look grammar', () => {
  test('the readings: each take and rest form builds its spec; the refusals', () => {
    expect(lookSpec('Look at the top five cards of your library. You may put a land card from among them onto the battlefield tapped. Put the rest on the bottom of your library in a random order.')).toMatchObject({ mode: 'auto', kinds: ['lookAtTop'], look: { take: 1, optional: true, rest: 'random', to: 'battlefield', tapped: true } });
    expect(lookSpec('Reveal the top five cards of your library. You may put a creature or land card from among them into your hand. Put the rest into your graveyard.')).toMatchObject({ mode: 'auto', look: { take: 1, optional: true, rest: 'graveyard', reveal: true } });
    expect(lookSpec("Reveal the top card of your library. If it's a land card, put it onto the battlefield. Otherwise, put that card into your hand.")).toMatchObject({ mode: 'auto', look: { take: 1, optional: false, rest: 'hand', to: 'battlefield', reveal: true } });
    expect(lookSpec("Look at the top card of your library. If it's a land card, you may reveal it and put it into your hand.")).toMatchObject({ mode: 'auto', look: { take: 1, optional: true, rest: 'top' } });
    expect(lookSpec('Look at the top six cards of your library. You may reveal a noncreature, nonland card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.')).toMatchObject({ mode: 'auto', look: { take: 1, optional: true, rest: 'random', filter: null, none: ['Creature', 'Land'] } });
    expect(lookSpec('Look at the top three cards of your library. Put two of them into your hand and the rest into your graveyard.')).toMatchObject({ mode: 'auto', look: { take: 2, optional: false, rest: 'graveyard' } });
    expect(lookSpec('Look at the top four cards of your library. Put a land card from among them into your hand and the rest on the bottom of your library in any order.')).toMatchObject({ mode: 'auto', look: { take: 1, optional: false, rest: 'bottomOrdered' } });
    // Refused: a trailing sentence the grammar does not read stays outside (the window is shorter, and the tail is read on its own).
    expect(lookSpec('Look at the top three cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard. Draw a card.')).toMatchObject({ mode: 'auto', kinds: ['lookAtTop', 'draw'] });
    // Refused: a one-card form over five cards; a noun outside the reader; a plain take of the whole run.
    expect(lookSpec("Look at the top five cards of your library. If it's a land card, put it into your hand.").mode).toBe('manual');
    expect(lookSpec('Look at the top five cards of your library. You may reveal a historic card from among them and put it into your hand. Put the rest into your graveyard.').mode).toBe('manual');
    expect(lookSpec('Look at the top two cards of your library. Put two of them into your hand.').mode).toBe('manual');
  });

  test('Elvish Rejuvenator: a land onto the battlefield tapped, the rest bottomed at random; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Elvish Rejuvenator', 'Grizzly Bears', 'Lightning Bolt', 'Divination'], ['Grizzly Bears']], scripts: createRegistry([entersLook('Elvish Rejuvenator')]) });
    holdEverywhere(g);
    const rej = put(g, 'p1', 'Elvish Rejuvenator', 'hand');
    main(g, 3);
    onTop(g, ['Grizzly Bears', 'Lightning Bolt', 'Forest', 'Divination', 'Forest']);
    const libBefore = (g.state.zones.library['p1'] ?? []).length;
    mana(g, 'GGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rej, targets: [] }));
    toPrompt(g);
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', zone: 'library', count: 1, min: 0, to: 'battlefield', tapped: true, rest: 'random' });
    const shown = (g.state.zones.library['p1'] ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(shown).toHaveLength(5);
    expect(shown.some((id) => g.state.cards[id]?.revealedTo.includes('p2')), 'a look is the looker alone').toBe(false);
    const bears = shown.find((id) => nameOf(g, id) === 'Grizzly Bears') as InstanceId;
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }).ok, 'a creature is not a land').toBe(false);
    const forest = shown.find((id) => nameOf(g, id) === 'Forest') as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[forest]?.tapped).toBe(true);
    expect((g.state.zones.library['p1'] ?? []).length).toBe(libBefore - 1);
    for (const id of shown) if (id !== forest) { expect(g.state.cards[id]?.zone.kind).toBe('library'); expect(g.state.cards[id]?.revealedTo).toEqual([]); }
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Grisly Salvage: a reveal every seat sees; a creature or land to the hand, the rest into the graveyard; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Grisly Salvage', 'Grizzly Bears', 'Lightning Bolt', 'Divination'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const salvage = put(g, 'p1', 'Grisly Salvage', 'hand');
    main(g, 3);
    onTop(g, ['Lightning Bolt', 'Divination', 'Grizzly Bears', 'Forest', 'Lightning Bolt']);
    mana(g, 'BG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: salvage, targets: [] }));
    toPrompt(g);
    const shown = (g.state.zones.library['p1'] ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(shown).toHaveLength(5);
    expect(shown.every((id) => g.state.cards[id]?.revealedTo.includes('p2')), 'a reveal is public').toBe(true);
    const bolt = shown.find((id) => nameOf(g, id) === 'Lightning Bolt') as InstanceId;
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] }).ok, 'an instant is neither a creature nor a land').toBe(false);
    const bears = shown.find((id) => nameOf(g, id) === 'Grizzly Bears') as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    for (const id of shown) if (id !== bears) expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Coiling Oracle: the one-card mandatory look asks nothing - a land goes onto the battlefield, a spell into the hand; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Coiling Oracle', 'Coiling Oracle', 'Grizzly Bears', 'Divination'], ['Grizzly Bears']], scripts: createRegistry([entersLook('Coiling Oracle')]) });
    holdEverywhere(g);
    const first = put(g, 'p1', 'Coiling Oracle', 'hand');
    main(g, 3);
    onTop(g, ['Forest']);
    const forest = (g.state.zones.library['p1'] ?? []).slice(-1)[0] as InstanceId;
    expect(nameOf(g, forest)).toBe('Forest');
    mana(g, 'GU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first, targets: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[forest]?.zone.kind, 'a land: onto the battlefield').toBe('battlefield');
    expect(g.state.cards[forest]?.tapped).toBe(false);
    expect(g.state.cards[forest]?.revealedTo).toEqual([]);
    const second = put(g, 'p1', 'Coiling Oracle', 'hand');
    onTop(g, ['Divination']);
    const div = (g.state.zones.library['p1'] ?? []).slice(-1)[0] as InstanceId;
    const hand = (g.state.zones.hand['p1'] ?? []).length;
    mana(g, 'GU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second, targets: [] }));
    settle(g);
    expect(g.state.cards[div]?.zone.kind, 'not a land: into the hand').toBe('hand');
    expect((g.state.zones.hand['p1'] ?? []).length, 'the Oracle left the hand, the Divination joined it').toBe(hand);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Wandering Mind: the negated noun refuses a creature and a land; a run admitting nothing asks nothing of a mandatory pick', () => {
    const g = startedGame({ players: 2, decks: [['Wandering Mind', 'Grizzly Bears', 'Lightning Bolt', 'Divination'], ['Grizzly Bears']], scripts: createRegistry([entersLook('Wandering Mind')]) });
    holdEverywhere(g);
    const mind = put(g, 'p1', 'Wandering Mind', 'hand');
    main(g, 3);
    onTop(g, ['Grizzly Bears', 'Forest', 'Lightning Bolt', 'Forest', 'Divination', 'Forest']);
    mana(g, 'UUR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mind, targets: [] }));
    toPrompt(g);
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', zone: 'library', count: 1, min: 0, none: ['Creature', 'Land'] });
    const shown = (g.state.zones.library['p1'] ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    const bears = shown.find((id) => nameOf(g, id) === 'Grizzly Bears') as InstanceId;
    const forest = shown.find((id) => nameOf(g, id) === 'Forest') as InstanceId;
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }).ok, 'noncreature').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }).ok, 'nonland').toBe(false);
    const bolt = shown.find((id) => nameOf(g, id) === 'Lightning Bolt') as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] }));
    settle(g);
    expect(g.state.cards[bolt]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    // A mandatory filtered pick over a run that admits nothing: the prompt's floor is zero, and the empty answer stands.
    const spec = lookSpec('Look at the top two cards of your library. Put a land card from among them into your hand and the rest into your graveyard.');
    expect(spec).toMatchObject({ mode: 'auto', look: { take: 1, optional: false, rest: 'graveyard' } });
    const h = startedGame({ players: 2, decks: [['Grizzly Bears', 'Lightning Bolt', 'Divination'], ['Grizzly Bears']], scripts: createRegistry([entersLook('Grizzly Bears', 'Look at the top two cards of your library. Put a land card from among them into your hand and the rest into your graveyard.')]) });
    holdEverywhere(h);
    const bears2 = put(h, 'p1', 'Grizzly Bears', 'hand');
    main(h, 3);
    onTop(h, ['Lightning Bolt', 'Divination']);
    mana(h, 'GG');
    must(h.submit({ t: 'CastSpell', player: 'p1', card: bears2, targets: [] }));
    toPrompt(h);
    expect(h.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', count: 1, min: 0 });
    must(h.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(h);
    expect((h.state.zones.graveyard['p1'] ?? []).length).toBe(2);
    expect(stateHash(replay(h.log, h.seed))).toBe(h.hash());
  });
});

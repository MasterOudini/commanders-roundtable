// D491 - THE FROM-HAND FREE CAST. `You may cast a spell with mana value N or less from your hand without paying its
// mana cost.` and its kin (the Expertise cycle; Counterlash's `that shares a card type with it`; Reinterpret's and
// Press the Enemy's `with equal or lesser mana value`; Electrodominance's `with mana value X or less`) read as a
// `castFromHand` clause: at resolution the bound is resolved (the spell's X, the first target's face for the referent
// forms - read off the state the spell resolved against, so a countered spell still reads), the controller's hand is
// asked through one reader (D416's bound plus castability), and the ANSWER begins the cast with nothing to pay - the
// cast's own questions (modes, targets) following, X 0, the granting effect's rest riding the pending cast. An empty
// answer casts nothing; backing out of the targets returns the card. What is proven here: the parser's readings; the
// bound refusing a pick and admitting one; the free cast's price (nothing), its mark and its resolution; the decline;
// the targets stage and the cancel; the referent forms after a counter and under X; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { poolTotal } from './types/mana';
import type { Game } from './game';

const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null && s.pendingCast === null, 20_000);
const toPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 400);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const freeCasts = (g: Game) => g.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.freeCast === true);
const tokensOf = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.isToken === true && g.state.cards[id]?.controller === who).length;

describe('D491 - the from-hand free cast', () => {
  test('the parser reads the grant, its noun, its bounds and the type share', () => {
    const sram = faceNamed("Sram's Expertise");
    expect(sram.effectMode).toBe('auto');
    expect(sram.effects.map((e) => e.kind)).toEqual(['createToken', 'castFromHand']);
    expect(sram.effects[1]?.castFree).toEqual({ none: [], filter: null, bound: { kind: 'n', n: 3 }, sharesType: false });
    expect(faceNamed("Kari Zev's Expertise").effectMode).toBe('auto');
    const counterlash = faceNamed('Counterlash');
    expect(counterlash.effects.map((e) => e.kind)).toEqual(['counter', 'castFromHand']);
    expect(counterlash.effects[1]?.castFree).toEqual({ none: [], filter: null, bound: null, sharesType: true });
    const reinterpret = faceNamed('Reinterpret');
    expect(reinterpret.effects[1]?.castFree).toEqual({ none: [], filter: null, bound: { kind: 'referent' }, sharesType: false });
    // Press the Enemy's first line (`target spell or nonland permanent an opponent controls`) is outside the vocabulary; the grant reads.
    const press = faceNamed('Press the Enemy').effects.find((e) => e.kind === 'castFromHand');
    expect(press?.castFree?.filter?.what).toBe('an instant or sorcery spell');
    expect(press?.castFree?.bound).toEqual({ kind: 'referent' });
    const electro = faceNamed('Electrodominance');
    expect(electro.effectMode).toBe('auto');
    expect(electro.effects[1]?.castFree?.bound).toEqual({ kind: 'x' });
  });

  test("Sram's Expertise: the bound refuses a five-drop, admits a two-drop, and the cast pays nothing", () => {
    const g = startedGame({ players: 2, decks: [["Sram's Expertise", 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const sram = put(g, 'p1', "Sram's Expertise", 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const angel = put(g, 'p1', 'Serra Angel', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sram, targets: [] }));
    toPrompt(g);
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', player: 'p1', zone: 'hand', count: 1, min: 0, castFree: true, qualifier: { manaValue: { op: 'lte', n: 3 } } });
    expect(g.state.cards[sram]?.zone.kind, 'the granting spell has resolved').toBe('graveyard');
    expect(tokensOf(g, 'p1'), 'the Servos came first').toBe(3);
    expect(poolTotal(g.state.players['p1']?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 })).toBe(0);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [angel] }).ok, 'mana value 5 is over the bound').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears, angel] }).ok, 'one card').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.pendingCast).toBeNull();
    expect(g.state.cards[bears]?.zone.kind).toBe('stack');
    expect(freeCasts(g)).toHaveLength(1);
    const cast = freeCasts(g)[0];
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.castFrom?.kind : null).toBe('hand');
    expect(poolTotal(g.state.players['p1']?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }), 'nothing was paid').toBe(0);
    expect(g.state.priority.player, 'the caster holds priority over the cast').toBe('p1');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[angel]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an empty answer casts nothing and the game goes on', () => {
    const g = startedGame({ players: 2, decks: [["Sram's Expertise", 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const sram = put(g, 'p1', "Sram's Expertise", 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sram, targets: [] }));
    toPrompt(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    expect(g.state.priority.awaiting).toBeNull();
    expect(freeCasts(g)).toHaveLength(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    settle(g);
    expect(tokensOf(g, 'p1')).toBe(3);
    expect(g.log.some((e) => e.body.t === 'Narrated' && JSON.stringify(e.body).includes('nothing'))).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a targeted pick asks its targets under the grant; backing out returns the card', () => {
    const g = startedGame({ players: 2, decks: [["Sram's Expertise", 'Lightning Bolt'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const sram = put(g, 'p1', "Sram's Expertise", 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sram, targets: [] }));
    toPrompt(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] }));
    expect(g.state.pendingCast).toMatchObject({ player: 'p1', card: bolt, stage: 'targets', free: true });
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseTargets', player: 'p1', forKind: 'spell' });
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.pendingCast).toBeNull();
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[bolt]?.zone.kind, 'back in hand').toBe('hand');
    expect(freeCasts(g)).toHaveLength(0);
    settle(g);
    expect(g.state.stack).toHaveLength(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a targeted pick cast free resolves against the target it named', () => {
    const g = startedGame({ players: 2, decks: [["Sram's Expertise", 'Lightning Bolt'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const sram = put(g, 'p1', "Sram's Expertise", 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sram, targets: [] }));
    toPrompt(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    expect(g.state.pendingCast).toBeNull();
    expect(freeCasts(g)).toHaveLength(1);
    expect(poolTotal(g.state.players['p1']?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 })).toBe(0);
    settle(g);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.cards[bolt]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Counterlash: the countered spell is the referent, and only a spell sharing its type may be cast', () => {
    const g = startedGame({ players: 2, decks: [['Counterlash', 'Serra Angel', 'Lightning Bolt'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const lash = put(g, 'p1', 'Counterlash', 'hand');
    const angel = put(g, 'p1', 'Serra Angel', 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
    main(g, 4, 'p2');
    mana(g, 'p2', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bears, targets: [] }));
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    const spell = g.state.stack[g.state.stack.length - 1];
    if (!spell) throw new Error('no spell on the stack');
    mana(g, 'p1', 'UUUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: lash, targets: [{ kind: 'stack', id: spell.id }] }));
    toPrompt(g);
    expect(g.state.cards[bears]?.zone.kind, 'countered before the grant').toBe('graveyard');
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', castFree: true, filter: { what: 'a spell that shares a card type with Grizzly Bears' } });
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] }).ok, 'an instant shares no type with a creature').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [angel] }));
    expect(freeCasts(g)).toHaveLength(1);
    settle(g);
    expect(g.state.cards[angel]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Electrodominance: the bound is the announced X', () => {
    const g = startedGame({ players: 2, decks: [['Electrodominance', 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const electro = put(g, 'p1', 'Electrodominance', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const angel = put(g, 'p1', 'Serra Angel', 'hand');
    main(g, 3);
    mana(g, 'p1', 'RRRR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: electro, xValue: 2, targets: [{ kind: 'player', id: 'p2' }] }));
    toPrompt(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'chooseFromZone', castFree: true, qualifier: { manaValue: { op: 'lte', n: 2 } } });
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [angel] }).ok).toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(freeCasts(g)).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

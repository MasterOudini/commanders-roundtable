// D526 - MANIFEST (CR 701.34). `Manifest the top card of your library` puts it onto the battlefield face down as a 2/2
// creature (D309's face-down object), and the permanent remembers it was manifested: a creature card may be turned
// face up for its mana cost (701.34c), a land may not. `Manifest dread` (701.34e) looks at the top two, puts one face
// down and the other into the graveyard - a look whose pick enters face down, with a marker for the heads and the
// fuzz. `Its controller manifests the top card of their library` (Reality Shift) manifests for the bound player, off
// that player's library. What is proven here: the parser's readings; the manifest, the flip and its refusal for a land;
// the dread's look, its pick and its marker; the referent player's manifest; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const onTop = (g: Game, who: 'p1' | 'p2', card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: who, card, to: { kind: 'library', player: who }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const chars = (g: Game, id: InstanceId) => derive(g.state, deps().oracle, deps().scripts, id);
const dreads = (g: Game) => g.log.filter((e) => e.body.t === 'ManifestedDread').map((e) => (e.body.t === 'ManifestedDread' ? e.body.card : null));

describe('D526 - manifest', () => {
  test('the parser reads the printed forms', () => {
    const summons = faceNamed('Soul Summons');
    expect(summons.effectMode).toBe('auto');
    expect(summons.effects.map((e) => e.kind)).toEqual(['manifest']);
    expect(summons.effects[0]?.amount).toBe(1);
    const ambush = faceNamed('Ethereal Ambush');
    expect(ambush.effectMode).toBe('auto');
    expect(ambush.effects[0]?.kind).toBe('manifest');
    expect(ambush.effects[0]?.amount).toBe(2);
    const dread = faceNamed('Manifest Dread');
    expect(dread.effectMode).toBe('auto');
    expect(dread.effects[0]?.kind).toBe('manifestDread');
    expect(dread.effects[0]?.look?.faceDown).toBe(true);
    expect(dread.effects[0]?.look?.rest).toBe('graveyard');
    const shift = faceNamed('Reality Shift');
    expect(shift.effectMode).toBe('auto');
    expect(shift.effects.map((e) => e.kind)).toEqual(['exile', 'manifest']);
    expect(shift.effects[1]?.ofPreviousPlayer).toBe('controller');
  });

  test('Soul Summons manifests the top card face down as a 2/2, and a creature card turns face up for its mana cost', () => {
    const g = startedGame({ players: 2, decks: [['Soul Summons', 'Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const summons = put(g, 'p1', 'Soul Summons', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main(g, 3);
    onTop(g, 'p1', bears);
    mana(g, 'p1', 'WW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: summons }));
    settle(g);
    const inst = g.state.cards[bears];
    expect(inst?.zone.kind).toBe('battlefield');
    expect(inst?.faceDown).toBe(true);
    expect(inst?.manifested).toBe(true);
    expect(inst?.controller).toBe('p1');
    expect(chars(g, bears).power, 'a face-down 2/2 with no name').toBe(2);
    expect(chars(g, bears).toughness).toBe(2);
    expect(chars(g, bears).name).toBe('');
    // The flip: its mana cost, {1}{G} - refused short of it, taken with it, and the Bears are the Bears again.
    expect(g.submit({ t: 'TurnFaceUp', player: 'p1', card: bears }).ok, 'no mana').toBe(false);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'TurnFaceUp', player: 'p1', card: bears }));
    expect(g.state.cards[bears]?.faceDown).toBe(false);
    expect(chars(g, bears).name).toBe('Grizzly Bears');
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0, 'no megamorph counter for a mana-cost flip').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a manifested land stays face down: there is no cost to turn it up', () => {
    const g = startedGame({ players: 2, decks: [['Soul Summons', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const summons = put(g, 'p1', 'Soul Summons', 'hand');
    const forest = put(g, 'p1', 'Forest', 'hand');
    main(g, 3);
    onTop(g, 'p1', forest);
    mana(g, 'p1', 'WWGGGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: summons }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[forest]?.faceDown).toBe(true);
    expect(chars(g, forest).isCreature, 'a face-down permanent is a creature whatever the card').toBe(true);
    expect(g.submit({ t: 'TurnFaceUp', player: 'p1', card: forest }).ok, 'a land has no mana cost to pay').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Manifest Dread looks at two, the pick enters face down, the other goes to the graveyard, and the marker names it', () => {
    const g = startedGame({ players: 2, decks: [['Manifest Dread', 'Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const dread = put(g, 'p1', 'Manifest Dread', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const forest = put(g, 'p1', 'Forest', 'hand');
    main(g, 3);
    onTop(g, 'p1', bears);
    onTop(g, 'p1', forest);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: dread }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const aw = g.state.priority.awaiting;
    expect(aw?.kind === 'chooseFromZone' ? aw.zone : null).toBe('library');
    expect(aw?.kind === 'chooseFromZone' ? aw.to : null).toBe('battlefield');
    expect(aw?.kind === 'chooseFromZone' ? aw.faceDown : null).toBe(true);
    expect(aw?.kind === 'chooseFromZone' ? aw.rest : null).toBe('graveyard');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.faceDown).toBe(true);
    expect(g.state.cards[bears]?.manifested).toBe(true);
    expect(g.state.cards[forest]?.zone.kind, 'the other card went to the graveyard').toBe('graveyard');
    expect(dreads(g)).toEqual([bears]);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'TurnFaceUp', player: 'p1', card: bears }));
    expect(chars(g, bears).name).toBe('Grizzly Bears');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Reality Shift exiles the creature and ITS CONTROLLER manifests the top card of their own library', () => {
    const g = startedGame({ players: 2, decks: [['Reality Shift', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Cyclops of One-Eyed Pass', 'Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const shift = put(g, 'p1', 'Reality Shift', 'hand');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    const theirs = put(g, 'p2', 'Grizzly Bears', 'hand');
    main(g, 3);
    onTop(g, 'p2', theirs);
    const mine = (g.state.zones.library.p1 ?? []).length;
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shift, targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind).toBe('exile');
    expect(g.state.cards[theirs]?.zone.kind, "the opponent's own top card").toBe('battlefield');
    expect(g.state.cards[theirs]?.controller).toBe('p2');
    expect(g.state.cards[theirs]?.faceDown).toBe(true);
    expect(g.state.cards[theirs]?.manifested).toBe(true);
    expect((g.state.zones.library.p1 ?? []).length, "the caster's library was not touched").toBe(mine);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

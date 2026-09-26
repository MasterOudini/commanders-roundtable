// D559 - TRANSMUTE (CR 702.53a): "[Cost], Discard this card: Search your library for a card with the same mana value as
// this card, reveal it, put it into your hand, then shuffle. Transmute only as a sorcery." A hand ability synthesized in
// reinforce's shape (`discardsSelf` - the discard a real discard), its own marker (never a cycling), its search the
// vocabulary's read of the face's own mana value, resolved natively. What is proven here: the readings (the search by
// mana value on each face - a land's is 0; the three spells and the keyword permanents complete); Dizzy Spell transmuted
// from the hand at sorcery speed, the card discarded as the cost, the search answered by mana value 1 alone (a mana value 4 refused); not offered in
// an opponent's turn and refused there; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { project } from './project';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const transmuteOf = (name: string) => ORACLE.byName(name)?.faces[0]?.activated.find((a) => a.transmute !== undefined);
const toLibrary = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' } }));
const mv = (spec: unknown) => (spec as { search?: { qualifier?: { manaValue?: { op: string; n: number } } } }).search?.qualifier?.manaValue;

describe('D559 - transmute', () => {
  test('the readings: a sorcery-speed hand ability searching the face' + "'" + 's own mana value; the spells and the keyword permanents complete', () => {
    const dizzy = transmuteOf('Dizzy Spell');
    expect([dizzy?.sorceryOnly, dizzy?.discardsSelf, dizzy?.cycling]).toEqual([true, true, undefined]);
    expect(dizzy?.costText).toBe('{1}{U}{U}, Discard this card');
    expect(mv(dizzy?.transmute?.effects?.[0]), 'Dizzy Spell is mana value 1').toEqual({ op: 'eq', n: 1 });
    expect(mv(transmuteOf('Tolaria West')?.transmute?.effects?.[0]), 'a land is mana value 0').toEqual({ op: 'eq', n: 0 });
    expect(mv(transmuteOf('Dimir House Guard')?.transmute?.effects?.[0])).toEqual({ op: 'eq', n: 4 });
    for (const name of ['Clutch of the Undercity', 'Muddle the Mixture', 'Dizzy Spell', 'Tolaria West', 'Drift of Phantasms']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('Dizzy Spell transmuted: offered from the hand, discarded as the cost, the search answered by mana value 1 alone', () => {
    const g = startedGame({ players: 2, decks: [['Dizzy Spell', 'Llanowar Elves', 'Hill Giant', 'Island', 'Island', 'Island', 'Island', 'Forest'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Dizzy Spell', 'hand');
    const elves = put(g, 'p1', 'Llanowar Elves', 'hand');
    const giant = put(g, 'p1', 'Hill Giant', 'hand');
    settle(g);
    main(g, 3);
    toLibrary(g, elves);
    toLibrary(g, giant);
    const offer = legalActions(g.state, ORACLE, SCRIPTS, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === spell);
    expect(offer, 'offered from the hand').toBeDefined();
    const idx = offer?.t === 'ActivateAbility' ? offer.abilityIndex : -1;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spell, abilityIndex: idx }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    expect(g.state.cards[spell]?.zone.kind, 'discarded as the cost').toBe('graveyard');
    const searching = project(g.state, ORACLE, SCRIPTS, 'p1').searching;
    expect(searching, 'the Elves, mana value 1').toContain(elves);
    // The search reveals the whole library to its searcher (D357); the host holds the answer to the mana value.
    expect(searching, 'the Hill Giant is revealed too').toContain(giant);
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [giant], declined: false }).ok, 'the Hill Giant is mana value 4').toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [elves], declined: false }));
    settle(g);
    expect(g.state.cards[elves]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[giant]?.zone.kind).toBe('library');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('only as a sorcery: not offered in an opponent' + "'" + 's turn, and refused there', () => {
    const g = startedGame({ players: 2, decks: [['Dizzy Spell', 'Island', 'Island', 'Island', 'Island'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Dizzy Spell', 'hand');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 40_000);
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const offered = legalActions(g.state, ORACLE, SCRIPTS, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === spell);
    expect(offered, 'not at instant speed').toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
    const idx = transmuteOf('Dizzy Spell')?.index ?? -1;
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: spell, abilityIndex: idx }).ok, 'the host refuses it too').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

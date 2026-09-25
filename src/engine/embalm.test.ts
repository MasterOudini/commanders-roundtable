// D546 - EMBALM and ETERNALIZE (CR 702.128a / 702.129a): "{cost}, Exile this card from your graveyard: Create a token
// that's a copy of it, except it's white, it has no mana cost, and it's a Zombie in addition to its other types. Embalm
// only as a sorcery." (eternalize: black, 4/4). A synthesized activated ability from the graveyard (scavenge's price),
// its effect the vocabulary's own token copy of `this card` with the rule's exceptions, resolved natively; the copy
// grammar reads the colour and "no mana cost", and derive honours both. What is proven here: the reading and the line
// accounted; the offer from the graveyard at sorcery speed and not at instant speed; Sacred Cat embalmed - the card in
// exile, a white Zombie Cat token with lifelink, 1/1, mana value 0; Adorned Pouncer eternalized - a black 4/4 Zombie Cat
// with double strike, mana value 0; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { linesUnaccounted } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const LANDS = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const offered = (g: Game, card: InstanceId) => legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === card);
const tokens = (g: Game) => (Object.keys(g.state.cards) as InstanceId[]).filter((id) => g.state.cards[id]?.isToken === true && g.state.cards[id]?.zone.kind === 'battlefield');

/** The card in p1's graveyard on p1's third main phase, `mana` white in the pool, the ability activated and resolved. */
function activated(name: string, mana: number): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[name, ...LANDS], [...LANDS]] });
  holdEverywhere(g);
  const card = put(g, 'p1', name, 'graveyard');
  main3(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: mana }));
  expect(offered(g, card), 'offered from the graveyard at sorcery speed').toBe(true);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card, abilityIndex: 0 }));
  settle(g);
  return { g, card };
}

describe('D546 - embalm and eternalize', () => {
  test('the reading: the copy and its exceptions, the line accounted', () => {
    const cat = faceNamed('Sacred Cat').activated.find((a) => a.embalm !== undefined);
    expect(cat?.embalm?.eternalize).toBe(false);
    expect(cat?.sorceryOnly).toBe(true);
    expect(cat?.exileSelfFromGraveyard).toBe(true);
    const spec = cat?.embalm?.effects?.[0];
    expect(spec?.kind).toBe('createToken');
    expect(spec?.copy?.of).toBe('self');
    expect(spec?.copy?.exceptions).toEqual({ colors: ['W'], noManaCost: true, addSubtypes: ['Zombie'] });
    const pouncer = faceNamed('Adorned Pouncer').activated.find((a) => a.embalm !== undefined);
    expect(pouncer?.embalm?.eternalize).toBe(true);
    expect(pouncer?.embalm?.effects?.[0]?.copy?.exceptions).toEqual({ colors: ['B'], power: 4, toughness: 4, noManaCost: true, addSubtypes: ['Zombie'] });
    for (const name of ['Sacred Cat', 'Adorned Pouncer']) {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      const printed = card?.faces[0];
      if (!card || !printed) throw new Error('no fixture ' + name);
      const open = linesUnaccounted(printed.oracleText, faceNamed(name), card.keywords).map((l) => l.text);
      expect(open, `${name}: every line the engine's`).toEqual([]);
    }
  });

  test('not at instant speed: the opponent\'s turn offers nothing', () => {
    const g = startedGame({ players: 2, decks: [['Sacred Cat', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const cat = put(g, 'p1', 'Sacred Cat', 'graveyard');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    expect(offered(g, cat)).toBe(false);
  });

  test('Sacred Cat embalmed: the card exiled, a white Zombie Cat token with lifelink, 1/1, mana value 0', () => {
    const { g, card } = activated('Sacred Cat', 1);
    expect(g.state.cards[card]?.zone.kind).toBe('exile');
    const made = tokens(g);
    expect(made).toHaveLength(1);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, made[0] as InstanceId);
    expect(d.name).toBe('Sacred Cat');
    expect(d.colors).toEqual(['W']);
    expect(d.typeLine.subtypes).toEqual(expect.arrayContaining(['Cat', 'Zombie']));
    expect(d.keywords.has('lifelink')).toBe(true);
    expect([d.power, d.toughness]).toEqual([1, 1]);
    expect(d.manaValue).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Adorned Pouncer eternalized: a black 4/4 Zombie Cat with double strike, mana value 0', () => {
    const { g, card } = activated('Adorned Pouncer', 5);
    expect(g.state.cards[card]?.zone.kind).toBe('exile');
    const made = tokens(g);
    expect(made).toHaveLength(1);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, made[0] as InstanceId);
    expect(d.colors).toEqual(['B']);
    expect(d.typeLine.subtypes).toEqual(expect.arrayContaining(['Cat', 'Zombie']));
    expect(d.keywords.has('doubleStrike')).toBe(true);
    expect([d.power, d.toughness]).toEqual([4, 4]);
    expect(d.manaValue).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

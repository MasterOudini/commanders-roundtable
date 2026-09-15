// D439 - THE UPKEEP PRICES: echo (CR 702.30) and cumulative upkeep (CR 702.24) run from the keyword-trigger table,
// their price read off the printed text at resolution and asked for by the vocabulary's own pay prompt (D369).
// The keyword is the engine's only for a price it can ask for (`readUpkeepPrice`, the one reader).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { parseFace, readUpkeepPrice } from '../data/oracleParse';
import { unaccountedLines } from '../data/engineComplete';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
/** p1 holds the priced permanent and its lands from turn 1; the game walks to p1's upkeep on `turn`. */
function armed(names: readonly string[], lands: readonly string[]): { g: Game; ids: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[...names, ...lands, ...TEN], ['Grizzly Bears', ...TEN]], scripts: createRegistry([]) });
  advanceUntil(g, (x) => x.stack.length === 0 && x.pendingTriggers.length === 0 && x.priority.awaiting === null, 20_000);
  holdEverywhere(g);
  const ids = names.map((n) => put(g, 'p1', n));
  for (const l of lands) put(g, 'p1', l);
  return { g, ids };
}
const atPrompt = (g: Game, turn: number): void =>
  advanceUntil(g, (x) => x.turn.turnNumber === turn && x.turn.step === 'upkeep' && x.priority.awaiting?.kind === 'payMana', 20_000);
const pastUpkeep = (g: Game, turn: number): void =>
  advanceUntil(g, (x) => x.turn.turnNumber === turn && x.turn.step === 'draw', 20_000);
const payPrompt = (g: Game) => {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'payMana') throw new Error('expected the pay prompt, got ' + (a?.kind ?? 'nothing'));
  return a;
};
const zoneOf = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';

describe('the upkeep prices (D439)', () => {
  test('echo: the upkeep after it entered asks for the echo cost; paid, it stays and is never asked again', () => {
    const { g, ids } = armed(['Shivan Raptor'], ['Mountain', 'Mountain', 'Mountain']);
    const raptor = ids[0] as InstanceId;
    atPrompt(g, 3);
    const a = payPrompt(g);
    expect(a.label).toContain('echo {2}{R}');
    expect(a.cost?.manaValue).toBe(3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    pastUpkeep(g, 3);
    expect(zoneOf(g, raptor)).toBe('battlefield');
    // Turn 5: it has been under p1's control since before the last upkeep - no echo.
    pastUpkeep(g, 5);
    expect(zoneOf(g, raptor)).toBe('battlefield');
    expect(g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana')).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('echo declined is a sacrifice; an echo nobody can pay is no question and the permanent goes', () => {
    const { g, ids } = armed(['Shivan Raptor'], ['Mountain', 'Mountain', 'Mountain']);
    atPrompt(g, 3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    pastUpkeep(g, 3);
    expect(zoneOf(g, ids[0] as InstanceId)).toBe('graveyard');

    const poor = armed(['Shivan Raptor'], ['Mountain']);
    pastUpkeep(poor.g, 3);
    expect(zoneOf(poor.g, poor.ids[0] as InstanceId)).toBe('graveyard');
    expect(poor.g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana')).toBe(false);
  });

  test('cumulative upkeep: an age counter each upkeep, the price times the counters; the third is declined', () => {
    const { g, ids } = armed(['Illusionary Forces'], ['Island', 'Island', 'Island']);
    const forces = ids[0] as InstanceId;
    for (const [turn, ages] of [[3, 1], [5, 2]] as const) {
      atPrompt(g, turn);
      expect(g.state.cards[forces]?.counters['age']).toBe(ages);
      expect(payPrompt(g).cost?.manaValue).toBe(ages);
      must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
      pastUpkeep(g, turn);
      expect(zoneOf(g, forces)).toBe('battlefield');
    }
    atPrompt(g, 7);
    expect(g.state.cards[forces]?.counters['age']).toBe(3);
    expect(payPrompt(g).cost?.manaValue).toBe(3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    pastUpkeep(g, 7);
    expect(zoneOf(g, forces)).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a life price scales the same way: Gallowbraid asks for 1 life, then 2', () => {
    const { g } = armed(['Gallowbraid'], []);
    atPrompt(g, 3);
    expect(payPrompt(g).life).toBe(1);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    pastUpkeep(g, 3);
    expect(g.state.players['p1']?.life).toBe(39);
    atPrompt(g, 5);
    expect(payPrompt(g).life).toBe(2);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    pastUpkeep(g, 5);
    expect(g.state.players['p1']?.life).toBe(37);
  });

  test('the gate: a price the engine cannot ask for leaves the keyword unclaimed and the line unaccounted', () => {
    const face = (name: string) => {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error(name + ' is not in the fixtures');
      return { card, parsed: parseFace(card, 0) };
    };
    const ECHO_REMINDER = ' (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)';
    expect(readUpkeepPrice('Echo {1}{R}' + ECHO_REMINDER, 'echo')).toEqual({ mana: '{1}{R}', life: 0, text: '{1}{R}' });
    expect(readUpkeepPrice('Cumulative upkeep—Pay 1 life. (At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.)', 'cumulativeUpkeep')).toEqual({ mana: null, life: 1, text: 'Pay 1 life.' });
    expect(readUpkeepPrice('Cumulative upkeep—Pay {B} and 1 life.', 'cumulativeUpkeep')).toEqual({ mana: '{B}', life: 1, text: 'Pay {B} and 1 life.' });
    expect(readUpkeepPrice('Echo—Discard a card.', 'echo')).toBeNull();
    expect(readUpkeepPrice('Cumulative upkeep {W} or {U}', 'cumulativeUpkeep')).toBeNull();
    expect(readUpkeepPrice('Cumulative upkeep {S}', 'cumulativeUpkeep')).toBeNull();
    expect(readUpkeepPrice('Cumulative upkeep—Add {R}.', 'cumulativeUpkeep')).toBeNull();
    expect(face('Shivan Raptor').parsed.keywords).toContain('echo');
    expect(face('Deepcavern Imp').parsed.keywords).not.toContain('echo');
    expect(face('Illusionary Forces').parsed.keywords).toContain('cumulativeUpkeep');
    expect(face('Braid of Fire').parsed.keywords).not.toContain('cumulativeUpkeep');
    expect(unaccountedLines(face('Shivan Raptor').card, 0)).toEqual([]);
    expect(unaccountedLines(face('Gallowbraid').card, 0)).toEqual([]);
    expect(unaccountedLines(face('Deepcavern Imp').card, 0).map((l) => l.text)).toContain('Echo—Discard a card.');
    expect(unaccountedLines(face('Braid of Fire').card, 0).map((l) => l.text)).toContain('Cumulative upkeep—Add {R}.');
  });
});

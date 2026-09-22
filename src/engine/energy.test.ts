// D519 - ENERGY COUNTERS (CR 122.1, 118.13). A player-side resource the engine now tracks and charges: `You get {E}{E}.`
// is `gainEnergy` (one counter per symbol), `Pay {E}{E}` is an activated cost piece (`energyCost`, charged in the cost
// batch, refused and withheld short of the counters), and a payment prompt's price may be energy (`you may pay
// {E}{E}. If you do, ...` - read as ENERGY, never as mana: until this decision `{E}{E}` fell through the mana parser as
// an EMPTY cost, a free price, latent only because no landed script carried it). The Tier-3 tool `ManualSetEnergy` sets
// it by hand and never below zero; the plate shows it while any is held. What is proven here: the readings (the payload,
// the prompt's price with and without mana, the older mana price unchanged, the activated cost piece); the tool, the
// reducer and the floor at zero; the executor's gain with its running total across two clauses in one resolution and its
// narration; the prompt raised only when the price can be paid, carrying the energy; the replay hash on each game.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { effectResult } from './effects';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const energyEvents = (events: readonly { t: string }[]) => events.filter((e): e is { t: 'EnergyChanged'; player: string; delta: number; to: number } => e.t === 'EnergyChanged').map((e) => ({ player: e.player, delta: e.delta, to: e.to }));

describe('D519 - energy counters', () => {
  test('the readings: the payload, the price as energy (never mana), the older mana price unchanged, the activated cost piece', () => {
    const gain = parseEffects('You get {E}{E}.', '~', true);
    expect(gain.mode).toBe('auto');
    expect(gain.effects.map((e) => ({ kind: e.kind, amount: e.amount }))).toEqual([{ kind: 'gainEnergy', amount: 2 }]);
    const asked = parseEffects('You may pay {E}{E}{E}. If you do, draw a card.', '~', true);
    expect(asked.mode).toBe('auto');
    expect(asked.effects[0]?.kind).toBe('payOptional');
    expect(asked.effects[0]?.pay?.cost, 'no mana in an energy price').toBeNull();
    expect(asked.effects[0]?.pay?.energy).toBe(3);
    expect(asked.effects[0]?.pay?.ifPaid.map((e) => e.kind)).toEqual(['draw']);
    const unless = parseEffects('Sacrifice this creature unless you pay {E}{E}.', '~', true);
    expect(unless.effects[0]?.pay?.energy).toBe(2);
    expect(unless.effects[0]?.pay?.ifNotPaid.map((e) => e.kind)).toEqual(['sacrificeSelf']);
    const older = parseEffects('You may pay {2}. If you do, draw a card.', '~', true);
    expect(older.effects[0]?.pay?.energy).toBe(0);
    expect(older.effects[0]?.pay?.cost?.generic).toBe(2);
    const abilities = parseActivatedAbilities({ oracleText: '{1}, Pay {E}{E}: Draw a card.\nPay {E}: This creature gets +1/+1 until end of turn.', isPermanent: true, producesMana: [], parseCost: parseManaCost });
    expect(abilities.map((a) => ({ energy: a.energyCost, mana: a.manaCost?.generic ?? null, payable: a.payable }))).toEqual([
      { energy: 2, mana: 1, payable: true },
      { energy: 1, mana: null, payable: true },
    ]);
  });

  test('the Tier-3 tool sets it, the reducer keeps it, never below zero; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    expect(g.state.players.p1?.energy).toBe(0);
    must(g.submit({ t: 'ManualSetEnergy', player: 'p1', target: 'p1', delta: 3 }));
    expect(g.state.players.p1?.energy).toBe(3);
    must(g.submit({ t: 'ManualSetEnergy', player: 'p1', target: 'p1', delta: -5 }));
    expect(g.state.players.p1?.energy, 'floored at zero').toBe(0);
    const last = g.log[g.log.length - 2]?.body;
    expect(last?.t === 'EnergyChanged' ? { delta: last.delta, to: last.to } : null, 'the event carries the real delta').toEqual({ delta: -3, to: 0 });
    expect(g.state.players.p2?.energy, "the other seat's untouched").toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the executor: a gain with its running total across two clauses, said; the prompt only when the price can be paid, carrying the energy', () => {
    const g = startedGame({ players: 2, decks: [['Sheltering Word', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const spell = put(g, 'p1', 'Sheltering Word', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.awaiting === null, 20_000);
    const obj = g.state.stack[0];
    if (!obj) throw new Error('no stack object');
    const gained = effectResult(g.state, g.deps, obj, parseEffects('You get {E}{E}. You get {E}.', '~', true).effects);
    expect(energyEvents(gained.events), 'two clauses, one resolution: running totals').toEqual([{ player: 'p1', delta: 2, to: 2 }, { player: 'p1', delta: 1, to: 3 }]);
    expect(gained.events.some((e) => e.t === 'Narrated' && /gets 2 energy/.test(e.text)), 'the gain is said').toBe(true);
    const asked = parseEffects('You may pay {E}{E}. If you do, draw a card.', '~', true).effects;
    const unpaid = effectResult(g.state, g.deps, obj, asked);
    expect(unpaid.events.some((e) => e.t === 'AwaitingSet'), 'no counters held: not a question (D369)').toBe(false);
    expect(unpaid.events.some((e) => e.t === 'Narrated' && /the price cannot be paid/.test(e.text))).toBe(true);
    must(g.submit({ t: 'ManualSetEnergy', player: 'p1', target: 'p1', delta: 2 }));
    const askedNow = effectResult(g.state, g.deps, obj, asked);
    const prompt = askedNow.events.find((e) => e.t === 'AwaitingSet');
    expect(prompt && prompt.t === 'AwaitingSet' && prompt.awaiting?.kind === 'payMana' ? { energy: prompt.awaiting.energy, cost: prompt.awaiting.cost, life: prompt.awaiting.life } : null).toEqual({ energy: 2, cost: null, life: 0 });
    settle(g);
    expect(g.state.players.p1?.energy, 'the real spell touched no energy').toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D512 - THE ADDITIONAL COMBAT PHASE (CR 500.8). `After this main phase, there is an additional combat phase followed by
// an additional main phase.` (Relentless Assault, Fury of the Horde, Seize the Day - sorceries all) and `After this (combat) phase, there
// is an additional combat phase.` (Aurelia, Hellkite Charger) put an entry on `TurnState.extraPhases`, keyed by the kind
// of phase it follows; `nextStep` inserts the phases at that phase's end - the most recently created first - and walks
// them (`insertedPhases`), then hands the turn back to the regular step that would have followed (`resumeStep`). An
// inserted main phase is a postcombat main phase (CR 505.1a). `Untap all creatures that attacked this turn.` reads the
// turn record. What is proven here: the readings (the two forms, the compound `and after this phase` as ONE clause with
// the phase riding the untap - a payment body reads it whole - the attacked-this-turn scope; `two additional combat phases` and the first-combat condition left unread); Relentless
// Assault in p1's postcombat main after the Bears attacked (the Bears untaps, a second combat follows in which it
// attacks again, then a second postcombat main, then the end step; the pending entry consumed, the queue empty after);
// the same spell in the precombat main (the inserted combat and main come BEFORE the regular combat: two combats and
// three main phases in the turn, the Bears attacking in the regular one); two Relentless Assaults in one main phase (both
// entries consumed at its end: three combats, three postcombat mains); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { Step } from './types/state';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const at = (g: Game, turn: number, step: Step) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.step === step && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, ...(e.extraPhases ? { extraPhases: e.extraPhases, extraAfter: e.extraAfter } : {}), ...(e.scopes ? { scopes: e.scopes } : {}) })) }; };
/** The steps turn `turn` began, in order, off the log. */
const stepsOf = (g: Game, turn: number): Step[] => {
  const out: Step[] = [];
  let t = 0;
  for (const e of g.log) {
    if (e.body.t === 'TurnBegan') t = e.body.turnNumber;
    if (e.body.t === 'StepBegan' && t === turn) out.push(e.body.step);
  }
  return out;
};
const attack = (g: Game, who: 'p1' | 'p2', card: string, defender: 'p1' | 'p2') => {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === who, 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: who, attackers: [{ card, defender: { kind: 'player', id: defender } }] }));
};

describe('D512 - the additional combat phase', () => {
  test('the readings: the main-phase form, the combat form, the compound as one clause, the attacked-this-turn scope; two phases and the first-combat condition unread', () => {
    expect(kinds('Untap all creatures that attacked this turn. After this main phase, there is an additional combat phase followed by an additional main phase.')).toEqual({
      mode: 'auto',
      effects: [
        { kind: 'massUntap', scopes: [{ kind: 'creature', controller: 'any', attackedThisTurn: true }] },
        { kind: 'extraCombat', extraPhases: ['combat', 'main'], extraAfter: 'main' },
      ],
    });
    expect(kinds('Untap target creature. After this main phase, there is an additional combat phase followed by an additional main phase.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'untap' }, { kind: 'extraCombat', extraAfter: 'main' }] });
    expect(kinds('Untap all creatures you control. After this phase, there is an additional combat phase.')).toEqual({
      mode: 'auto',
      effects: [{ kind: 'massUntap', scopes: [{ kind: 'creature', controller: 'you' }] }, { kind: 'extraCombat', extraPhases: ['combat'], extraAfter: 'current' }],
    });
    // the compound is ONE clause - the untap with the phase riding it - so a payment body (`If you do, ...`) reads it whole.
    expect(kinds('Untap all attacking creatures and after this phase, there is an additional combat phase.')).toEqual({
      mode: 'auto',
      effects: [{ kind: 'massUntap', extraPhases: ['combat'], extraAfter: 'current', scopes: [{ kind: 'creature', controller: 'any', attacking: true }] }],
    });
    expect(kinds('You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.')).toMatchObject({
      mode: 'auto',
      effects: [{ kind: 'payOptional' }],
    });
    expect(parseEffects('You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.', '~', true).effects[0]?.pay?.ifPaid.map((e) => ({ kind: e.kind, extraPhases: e.extraPhases }))).toEqual([{ kind: 'massUntap', extraPhases: ['combat'] }]);
    expect(kinds('Untap all creatures you control that attacked this turn. After this combat phase, there is an additional combat phase.')).toMatchObject({
      mode: 'auto',
      effects: [{ kind: 'massUntap', scopes: [{ kind: 'creature', controller: 'you', attackedThisTurn: true }] }, { kind: 'extraCombat', extraAfter: 'current' }],
    });
    expect(kinds('After this main phase, there are two additional combat phases.').mode).not.toBe('auto');
    expect(kinds("If it's the first combat phase of the turn, there is an additional combat phase after this phase.").mode).not.toBe('auto');
  });

  test('Relentless Assault in the postcombat main after the Bears attacked: the Bears untaps, a second combat follows and it attacks again, then a second main, then the end step; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Relentless Assault', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Relentless Assault', 'hand');
    at(g, 3, 'precombatMain');
    attack(g, 'p1', bears, 'p2');
    at(g, 3, 'postcombatMain');
    expect(g.state.cards[bears]?.tapped, 'attacked, tapped').toBe(true);
    const life0 = g.state.players.p2?.life ?? 0;
    mana(g, 'p1', 'RRCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped, 'untapped by the spell').toBe(false);
    expect(g.state.turn.extraPhases, 'pending until this main phase ends').toEqual([{ after: 'main', phases: ['combat', 'main'] }]);
    expect(g.log.some((e) => e.body.t === 'Narrated' && e.body.text.includes('an additional combat phase followed by an additional main phase after this main phase')), 'said out loud').toBe(true);
    // the inserted combat: the Bears attacks again and deals its damage a second time.
    attack(g, 'p1', bears, 'p2');
    at(g, 3, 'postcombatMain');
    expect(g.state.turn.extraPhases, 'consumed').toEqual([]);
    expect(g.state.turn.insertedPhases, 'the inserted main is the last of them').toEqual([]);
    expect(g.state.turn.resumeStep, 'the regular sequence resumes at the end step').toBe('end');
    expect(g.state.players.p2?.life).toBe(life0 - 2);
    at(g, 3, 'end');
    expect(g.state.turn.resumeStep).toBeNull();
    expect(stepsOf(g, 3).filter((s) => s === 'beginCombat')).toHaveLength(2);
    expect(stepsOf(g, 3).filter((s) => s === 'postcombatMain')).toHaveLength(2);
    expect(stepsOf(g, 3).slice(-8)).toEqual(['postcombatMain', 'beginCombat', 'declareAttackers', 'declareBlockers', 'combatDamage', 'endCombat', 'postcombatMain', 'end']);
    at(g, 4, 'precombatMain');
    expect(g.state.turn.turnNumber, 'the next turn follows the end step as ever').toBe(4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Relentless Assault in the precombat main: the inserted combat and main come before the regular combat (two combats, three main phases); the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Relentless Assault', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Relentless Assault', 'hand');
    at(g, 3, 'precombatMain');
    mana(g, 'p1', 'RRCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.log.filter((e) => e.body.t === 'ScopeWalked' && e.body.verb === 'massUntap').map((e) => (e.body.t === 'ScopeWalked' ? e.body.members : -1)), 'nothing attacked yet: the walk finds nobody').toEqual([0]);
    // the inserted combat first (the Bears stays home), then the inserted main, then the regular combat (it attacks).
    advanceUntil(g, (s) => s.turn.step === 'beginCombat', 20_000);
    expect(g.state.turn.resumeStep, 'the regular combat is where the turn resumes').toBe('beginCombat');
    expect(g.state.turn.insertedPhases).toEqual(['main']);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }));
    at(g, 3, 'postcombatMain');
    expect(g.state.turn.insertedPhases).toEqual([]);
    expect(g.state.turn.resumeStep).toBe('beginCombat');
    attack(g, 'p1', bears, 'p2');
    advanceUntil(g, (s) => s.turn.step === 'endCombat', 20_000);
    expect(g.state.turn.resumeStep, 'the regular combat: nothing to resume').toBeNull();
    at(g, 3, 'end');
    expect(stepsOf(g, 3)).toEqual(['untap', 'upkeep', 'draw', 'precombatMain', 'beginCombat', 'declareAttackers', 'endCombat', 'postcombatMain', 'beginCombat', 'declareAttackers', 'declareBlockers', 'combatDamage', 'endCombat', 'postcombatMain', 'end']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two Relentless Assaults in one postcombat main: both entries are consumed at its end (three combats, three postcombat mains); the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Relentless Assault', 'Relentless Assault', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const first = put(g, 'p1', 'Relentless Assault', 'hand');
    const second = put(g, 'p1', 'Relentless Assault', 'hand');
    at(g, 3, 'precombatMain');
    attack(g, 'p1', bears, 'p2');
    at(g, 3, 'postcombatMain');
    const life0 = g.state.players.p2?.life ?? 0;
    mana(g, 'p1', 'RRCCRRCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first, targets: [] }));
    settle(g);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second, targets: [] }));
    settle(g);
    expect(g.state.turn.extraPhases, 'two entries pending').toHaveLength(2);
    // the second combat: the Bears (untapped by the spells) attacks; the third: it is tapped from the second and stays home.
    attack(g, 'p1', bears, 'p2');
    at(g, 3, 'postcombatMain');
    expect(g.state.turn.extraPhases).toEqual([]);
    expect(g.state.turn.insertedPhases, 'the other entry still to run').toEqual(['combat', 'main']);
    // a tapped Bears is no attacker, so the third combat asks nothing (D-era rule: no prompt with nothing to decide).
    at(g, 3, 'declareAttackers');
    expect(g.state.cards[bears]?.tapped, 'tapped from the second combat').toBe(true);
    expect(g.state.combat?.attackers, 'nobody attacks in the third combat').toEqual([]);
    at(g, 3, 'end');
    expect(stepsOf(g, 3).filter((s) => s === 'beginCombat')).toHaveLength(3);
    expect(stepsOf(g, 3).filter((s) => s === 'postcombatMain')).toHaveLength(3);
    expect(g.state.players.p2?.life).toBe(life0 - 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

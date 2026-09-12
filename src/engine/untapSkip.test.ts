// D411 - THE UNTAP SKIP: "doesn't untap during its controller's next untap step" - a flag the effect sets
// (or a mana ability's rider sets when the mana is made), spent by that untap STEP whether or not the
// permanent was tapped, cleared by leaving the battlefield. The referent rewrite reaches the tapped
// target ("Tap target creature. It doesn't untap ..."); the painland's damage is charged by an auto-paid
// cast too (the D355 gap).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** A def whose payload is the printed sentence(s), read by the vocabulary bridge. */
function etb(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'etb-0', text: card.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
function attacks(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'attacks-0', text: card.faces[0]?.oracleText ?? '', event: 'AttackersDeclared', activeZones: ['battlefield'], optional: false, targets: [],
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, []),
    }],
  };
}
const SCRIPTS = createRegistry([
  etb('Frost Trickster', "Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step."),
  attacks('Apes of Rath', "it doesn't untap during its controller's next untap step."),
]);
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: SCRIPTS });
  holdEverywhere(g);
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const skips = (g: Game) => g.log.filter((e) => e.body.t === 'UntapSkipSet').map((e) => e.body as Extract<EventBody, { t: 'UntapSkipSet' }>);
/** Past the next untap step of `player`'s own turn, into its first main phase. */
function pastUntapOf(g: Game, player: 'p1' | 'p2'): void {
  const t = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber > t && s.turn.activePlayer === player && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 40_000);
}

describe('the untap skip (D411)', () => {
  test('Frost Trickster: the Cyclops is tapped and frozen; it sits out its controller untap step and untaps the one after; the step spends the flag', () => {
    const g = armed([['Frost Trickster'], ['Cyclops of One-Eyed Pass']]);
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    put(g, 'p1', 'Frost Trickster');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.tapped).toBe(true);
    expect(g.state.cards[cyclops]?.skipsUntap).toBe(true);
    expect(skips(g)).toEqual([{ t: 'UntapSkipSet', card: cyclops, skip: true }]);
    pastUntapOf(g, 'p2');
    expect(g.state.cards[cyclops]?.tapped, 'sat out the untap step').toBe(true);
    expect(g.state.cards[cyclops]?.skipsUntap, 'the step spent the skip').toBeUndefined();
    expect(g.log.some((e) => e.body.t === 'Narrated' && /doesn't untap this turn/.test(e.body.text))).toBe(true);
    pastUntapOf(g, 'p2');
    expect(g.state.cards[cyclops]?.tapped, 'untaps the turn after').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Take into Custody: the spell reaches the tapped target through the referent; an untapped frozen creature still spends the skip at the step', () => {
    const g = armed([['Take into Custody'], ['Cyclops of One-Eyed Pass']]);
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const spell = put(g, 'p1', 'Take into Custody', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.tapped).toBe(true);
    expect(g.state.cards[cyclops]?.skipsUntap).toBe(true);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [cyclops], tapped: false }));
    pastUntapOf(g, 'p2');
    expect(g.state.cards[cyclops]?.skipsUntap).toBeUndefined();
    expect(g.state.cards[cyclops]?.tapped).toBe(false);
  });

  test('Apes of Rath: the self form on an attack; leaving the battlefield clears the flag', () => {
    const g = armed([['Apes of Rath'], ['Cyclops of One-Eyed Pass']]);
    const apes = put(g, 'p1', 'Apes of Rath');
    settle(g);
    pastUntapOf(g, 'p1');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: apes, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[apes]?.skipsUntap).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: apes, to: { kind: 'hand', player: 'p1' } }));
    expect(g.state.cards[apes]?.skipsUntap, 'a new object owes nothing').toBeUndefined();
  });

  test('Thalakos Lowlands: the coloured ability sets the skip by hand and under an auto-paid cast, the colourless one does not; the painland pays under an auto-paid cast too', () => {
    const g = armed([['Thalakos Lowlands', 'Karplusan Forest', 'Savannah Lions', 'Raging Goblin'], ['Cyclops of One-Eyed Pass']]);
    const low = put(g, 'p1', 'Thalakos Lowlands');
    settle(g);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: low, abilityIndex: 0, outputChoice: 0 }));
    expect(g.state.cards[low]?.skipsUntap, 'the {C} ability carries no rider').toBeUndefined();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [low], tapped: false }));
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    must(g.submit({ t: 'TapForMana', player: 'p1', card: low, abilityIndex: 1, outputChoice: 0 }));
    expect(g.state.cards[low]?.skipsUntap, 'the coloured ability sets it').toBe(true);
    pastUntapOf(g, 'p1');
    expect(g.state.cards[low]?.tapped).toBe(true);
    expect(g.state.cards[low]?.skipsUntap).toBeUndefined();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [low], tapped: false }));
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    const lions = put(g, 'p1', 'Savannah Lions', 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: lions, targets: [] }));
    settle(g);
    expect(g.state.cards[lions]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[low]?.tapped).toBe(true);
    expect(g.state.cards[low]?.skipsUntap, 'the plan taps charge the rider').toBe(true);
    const forest = put(g, 'p1', 'Karplusan Forest');
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const goblin = put(g, 'p1', 'Raging Goblin', 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: goblin, targets: [] }));
    settle(g);
    expect(g.state.cards[goblin]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[forest]?.tapped).toBe(true);
    expect(g.state.players.p1?.life, 'the painland charged under an auto-paid cast').toBe(life0 - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D311 - THE CREW SEAM, in the engine: a Vehicle crewed by creatures whose
// power reaches its crew number becomes an artifact creature until end of
// turn (its printed P/T and keywords live), the crew are tapped, too little
// power is refused, the animation ends at cleanup, the offer names the power,
// and the games replay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { derive } from './derive';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registry';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function main3(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

function chars(g: Game, id: InstanceId) {
  const d = deps(createRegistry([]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { types: got.typeLine.types, power: got.power, toughness: got.toughness, keywords: [...got.keywords] };
}

function crewIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([]));
  const inst = g.state.cards[id];
  const card = inst ? d.oracle.byPrinting(inst.printingId) : undefined;
  const face = card?.faces[0];
  const ability = face?.activated.find((a) => a.crew !== undefined);
  if (!ability) throw new Error('no crew ability');
  return ability.index;
}

describe('the crew seam (D311)', () => {
  test('Sky Skiff crewed by a 2/2 is a flying artifact creature until end of turn; the crew is tapped', () => {
    const g = startedGame({ players: 2, decks: [['Sky Skiff', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const skiff = put(g, 'p1', 'Sky Skiff');
    const bears = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    main3(g);
    const before = chars(g, skiff);
    expect(before.types).toEqual(['Artifact']);
    const d = deps(createRegistry([]));
    const offer = legalActions(g.state, d.oracle, d.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === skiff);
    expect(offer && offer.t === 'ActivateAbility' ? offer.tapPower : undefined).toBe(1);
    expect(offer && offer.t === 'ActivateAbility' ? offer.tapCandidates : undefined).toEqual([bears]);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: skiff, abilityIndex: crewIndex(g, skiff), tap: [bears] }));
    settle(g);
    const after = chars(g, skiff);
    expect(after.types).toEqual(['Artifact', 'Creature']);
    expect([after.power, after.toughness]).toEqual([2, 3]);
    expect(after.keywords).toContain('flying');
    expect(g.state.cards[bears]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(chars(g, skiff).types).toEqual(['Artifact']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Consulate Dreadnought (a 7/11) needs power six: a 2/2 alone is refused, a 5/2 with it is enough', () => {
    const g = startedGame({ players: 2, decks: [['Consulate Dreadnought', 'Grizzly Bears', 'Cyclops of One-Eyed Pass'], ['Coral Eel']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const dreadnought = put(g, 'p1', 'Consulate Dreadnought');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const cyclops = put(g, 'p1', 'Cyclops of One-Eyed Pass');
    put(g, 'p2', 'Coral Eel');
    settle(g);
    main3(g);
    const idx = crewIndex(g, dreadnought);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: dreadnought, abilityIndex: idx, tap: [bears] }).ok).toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: dreadnought, abilityIndex: idx, tap: [] }).ok).toBe(false);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: dreadnought, abilityIndex: idx, tap: [bears, cyclops] }));
    settle(g);
    const c = chars(g, dreadnought);
    expect(c.types).toEqual(['Artifact', 'Creature']);
    expect([c.power, c.toughness]).toEqual([7, 11]);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[cyclops]?.tapped).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a Vehicle with no crew to reach its number is not offered; a tapped creature does not count', () => {
    const g = startedGame({ players: 2, decks: [['Consulate Dreadnought', 'Grizzly Bears'], ['Coral Eel']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const dreadnought = put(g, 'p1', 'Consulate Dreadnought');
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p2', 'Coral Eel');
    settle(g);
    main3(g);
    const d = deps(createRegistry([]));
    const offers = legalActions(g.state, d.oracle, d.scripts, 'p1').filter((a) => a.t === 'ActivateAbility' && a.card === dreadnought);
    expect(offers).toEqual([]);
  });
});

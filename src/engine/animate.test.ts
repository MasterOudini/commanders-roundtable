// D395 - THE ANIMATE FAMILY (CR 613.4b): "<this land | target land> becomes a N/N [colour] [Type]
// [artifact] creature [with KW] until end of turn." is one until-end-of-turn entry - a base P/T at
// layer 7b, Creature (and Artifact when the text says so) with its subtypes at layer 4, colours at
// layer 5, keywords at layer 6 - and cleanup ends it with the pumps. "It's still a land." beside
// it is a noop. The duration may be fronted or trailing; a P/T with X stays unread.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

function derived(g: Game, id: InstanceId) {
  const d = deps(createRegistry([]));
  return derive(g.state, d.oracle, d.scripts, id);
}

describe('the animate vocabulary (D395)', () => {
  test('a manland, a keyrune and a targeted spell read whole, the shape captured', () => {
    const village = parseEffects("This land becomes a 3/3 green Ape creature with trample until end of turn. It's still a land.", 'Treetop Village', true);
    expect(village.mode).toBe('auto');
    expect(village.effects.map((e) => e.kind)).toEqual(['animate', 'noop']);
    expect(village.effects[0]?.self).toBe(true);
    expect(village.effects[0]?.animate).toEqual({ power: 3, toughness: 3, colors: ['G'], subtypes: ['Ape'], artifact: false, keywords: ['trample'] });
    const idol = parseEffects('This artifact becomes a 2/2 Golem artifact creature until end of turn.', 'Guardian Idol', true);
    expect(idol.mode).toBe('auto');
    expect(idol.effects[0]?.animate).toEqual({ power: 2, toughness: 2, colors: [], subtypes: ['Golem'], artifact: true, keywords: [] });
    const hydro = parseEffects("Target land becomes a 3/3 Elemental creature with flying until end of turn. It's still a land.", 'Hydroform', true);
    expect(hydro.mode).toBe('auto');
    expect(hydro.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['animate', 0], ['noop', -1]]);
    expect(hydro.effects[0]?.animate?.subtypes).toEqual(['Elemental']);
  });

  test('the fronted duration, two colours and two keywords read; X and a missing duration stay unread', () => {
    const colonnade = parseEffects("Until end of turn, this land becomes a 4/4 white and blue Elemental creature with flying and vigilance. It's still a land.", 'Celestial Colonnade', true);
    expect(colonnade.mode).toBe('auto');
    expect(colonnade.effects[0]?.animate).toEqual({ power: 4, toughness: 4, colors: ['W', 'U'], subtypes: ['Elemental'], artifact: false, keywords: ['flying', 'vigilance'] });
    expect(parseEffects("Until end of turn, this land becomes an X/X green Hydra creature. It's still a land.", 'Lair of the Hydra', true).mode).not.toBe('auto');
    expect(parseEffects('This land becomes a 2/2 Elemental creature.', 'Test Card', true).mode).not.toBe('auto');
    expect(parseEffects('Until end of turn, this land becomes a 2/2 Elemental creature until end of turn.', 'Test Card', true).mode).not.toBe('auto');
  });
});

describe('animate in play (D395)', () => {
  test('Hydroform makes a land a 3/3 flying Elemental creature until cleanup, and the game replays', () => {
    const g = startedGame({ players: 2, decks: [['Hydroform', 'Forest'], ['Grizzly Bears']] });
    const forest = put(g, 'p1', 'Forest');
    settle(g);
    const before = derived(g, forest);
    expect(before.power).toBeNull();
    expect(before.isCreature).toBe(false);
    const hydro = put(g, 'p1', 'Hydroform', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: hydro, targets: [{ kind: 'card', id: forest }] }));
    settle(g);
    const t0 = g.state.turn.turnNumber;
    const d = derived(g, forest);
    expect([d.power, d.toughness], 'the base P/T set at layer 7b').toEqual([3, 3]);
    expect(d.isCreature, 'a creature at layer 4').toBe(true);
    expect(d.typeLine.types).toContain('Land');
    expect(d.typeLine.subtypes).toContain('Elemental');
    expect(d.keywords.has('flying'), 'the keyword at layer 6').toBe(true);
    // Cleanup ends it with the pumps: a land again, no P/T, no Elemental.
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 1, 20_000);
    const after = derived(g, forest);
    expect(after.power).toBeNull();
    expect(after.isCreature).toBe(false);
    expect(after.typeLine.subtypes).not.toContain('Elemental');
    expect(g.state.untilEndOfTurn.some((m) => m.basePt !== undefined)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

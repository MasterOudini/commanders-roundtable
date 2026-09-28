// D578 - A DEF'S FACE: a two-faced card's script carries both faces' abilities, and a def tagged `face: N` runs only
// while its permanent has face N up (CR 712.8). What is proven here, on a test script over Tavern Ruffian // Tavern
// Smasher: `defOnFace` itself; a static tagged face 0 and one tagged face 1 (the Ruffian's +1/+0 only while the front is
// up, the Smasher's +0/+1 only while the back is); a trigger tagged face 1 that fires only after the flip; an untagged
// def that runs on both faces; the replay hash.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { defOnFace, type CardScript } from './scripts/api';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { EventBody } from './types/events';

const RUFFIAN = 'Tavern Ruffian // Tavern Smasher';
const oracleIdOf = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return c.oracleId; };

const TEST_SCRIPT: CardScript = {
  oracleId: oracleIdOf(RUFFIAN),
  name: RUFFIAN,
  statics: [
    { abilityId: 's0', text: 'TEST front: +1/+0.', face: 0, layer: 'ptModify', activeZones: ['battlefield'], appliesTo: (_ctx, self, candidate) => candidate === self, modify: (chars) => { chars.power = (chars.power ?? 0) + 1; } },
    { abilityId: 's1', text: 'TEST back: +0/+1.', face: 1, layer: 'ptModify', activeZones: ['battlefield'], appliesTo: (_ctx, self, candidate) => candidate === self, modify: (chars) => { chars.toughness = (chars.toughness ?? 0) + 1; } },
    { abilityId: 's2', text: 'TEST both: +10/+0.', layer: 'ptModify', activeZones: ['battlefield'], appliesTo: (_ctx, self, candidate) => candidate === self, modify: (chars) => { chars.power = (chars.power ?? 0) + 10; } },
  ],
  triggers: [
    {
      abilityId: 't1',
      text: 'TEST back: whenever another creature enters, you gain 1 life.',
      face: 1,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card !== self && m.to.kind === 'battlefield'),
      label: () => 'TEST back - gain 1 life',
      resolve: (ctx, self): readonly EventBody[] => {
        const who = ctx.state.cards[self]?.controller ?? 'p1';
        const life = ctx.state.players[who]?.life ?? 0;
        return [{ t: 'LifeChanged', player: who, delta: 1, to: life + 1 }];
      },
    },
  ],
};

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const pt = (g: Game, id: string) => { const d = deps(createRegistry([TEST_SCRIPT])); const c = derive(g.state, d.oracle, d.scripts, id); return [c.power, c.toughness]; };

describe('D578 - a def' + "'" + 's face', () => {
  test('defOnFace: untagged on every face, tagged on its own', () => {
    expect([defOnFace({}, 0), defOnFace({}, 1), defOnFace({}, undefined)]).toEqual([true, true, true]);
    expect([defOnFace({ face: 0 }, 0), defOnFace({ face: 0 }, undefined), defOnFace({ face: 0 }, 1)]).toEqual([true, true, false]);
    expect([defOnFace({ face: 1 }, 1), defOnFace({ face: 1 }, 0)]).toEqual([true, false]);
  });

  test('the statics and the trigger follow the face up; the untagged static runs on both', () => {
    const g = startedGame({ players: 2, decks: [[RUFFIAN, 'Grizzly Bears', 'Grizzly Bears', 'Mountain', 'Mountain'], ['Mountain']], scripts: createRegistry([TEST_SCRIPT]) });
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const self = put(g, 'p1', RUFFIAN, 'battlefield');
    settle(g);
    expect(g.state.cards[self]?.faceIndex).toBe(0);
    expect(pt(g, self), 'Tavern Ruffian 2/5 with the front +1/+0 and the untagged +10/+0').toEqual([13, 5]);
    const life0 = g.state.players.p1?.life ?? 0;
    put(g, 'p1', 'Grizzly Bears', 'battlefield');
    settle(g);
    expect(g.state.players.p1?.life, 'the back face' + "'" + 's trigger is off while the front is up').toBe(life0);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    expect(g.state.cards[self]?.faceIndex).toBe(1);
    expect(pt(g, self), 'Tavern Smasher 6/5 with the back +0/+1 and the untagged +10/+0').toEqual([16, 6]);
    put(g, 'p1', 'Grizzly Bears', 'battlefield');
    settle(g);
    expect(g.state.players.p1?.life, 'the back face' + "'" + 's trigger fires').toBe(life0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

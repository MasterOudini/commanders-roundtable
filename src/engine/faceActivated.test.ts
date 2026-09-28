// D582 - A FACE'S OWN ACTIVATED ABILITIES (CR 712.8 - a transformed permanent has only its face up's abilities). Vildin-Pack
// Outcast // Dronepack Kindred prints `{R}: +1/-1` at the front's face-local index 0 and `{1}: +1/+0` at the back's - one
// `#a0` ref, two defs tagged by face (`ActivatedDef.face`). Proven on test scripts: the face up picks the def; the stack
// object keeps the face it was activated from (`abilityFace`, absent on face 0), so a flip while it waits changes nothing
// (CR 113.7a); a def tagged with the other face is never this face's (a script-less ability resolves nothing); and the
// transforms-into head the rows use - a `FaceIndexSet` trigger tagged with the face it turns INTO fires on that flip alone
// (the bus asks the face on the board after the flip). The replay hash.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import type { ActivatedDef, CardScript } from './scripts/api';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { EventBody } from './types/events';

const OUTCAST = 'Vildin-Pack Outcast // Dronepack Kindred';
const oracleIdOf = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return c.oracleId; };
const OID = oracleIdOf(OUTCAST);

const gain = (n: number): ActivatedDef['resolve'] => (ctx, _self, obj): readonly EventBody[] => {
  const life = ctx.state.players[obj.controller]?.life ?? 0;
  return [{ t: 'LifeChanged', player: obj.controller, delta: n, to: life + n }];
};
const FRONT_DEF: ActivatedDef = { ref: `${OID}#a0`, face: 0, text: 'TEST front: you gain 1 life.', resolve: gain(1) };
const BACK_DEF: ActivatedDef = { ref: `${OID}#a0`, face: 1, text: 'TEST back: you gain 2 life.', resolve: gain(2) };
const BOTH: CardScript = { oracleId: OID, name: OUTCAST, activated: [FRONT_DEF, BACK_DEF] };
const BACK_ONLY: CardScript = { oracleId: OID, name: OUTCAST, activated: [BACK_DEF] };
const TURNED: CardScript = {
  oracleId: OID,
  name: OUTCAST,
  triggers: [
    {
      abilityId: 'transformsInto',
      text: 'TEST back: when this creature transforms into Dronepack Kindred, you gain 3 life.',
      face: 1,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceIndexSet' && ev.card === self,
      label: () => 'TEST back - gain 3 life',
      resolve: (ctx, self): readonly EventBody[] => {
        const who = ctx.state.cards[self]?.controller ?? 'p1';
        const life = ctx.state.players[who]?.life ?? 0;
        return [{ t: 'LifeChanged', player: who, delta: 3, to: life + 3 }];
      },
    },
  ],
};

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const life = (g: Game) => g.state.players.p1?.life ?? 0;
function staged(script: CardScript): { g: Game; self: string } {
  const g = startedGame({ players: 2, decks: [[OUTCAST, 'Mountain', 'Mountain', 'Mountain', 'Mountain'], ['Mountain']], scripts: createRegistry([script]) });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const self = put(g, 'p1', OUTCAST, 'battlefield');
  settle(g);
  return { g, self };
}
const activate = (g: Game, self: string) => {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
};

describe('D582 - a face' + "'" + 's own activated abilities', () => {
  test('the face up picks the def at one face-local index; the object keeps the face it was activated from', () => {
    const { g, self } = staged(BOTH);
    expect(g.state.cards[self]?.faceIndex).toBe(0);
    const life0 = life(g);
    activate(g, self);
    expect(g.state.stack.at(-1)?.abilityFace, 'absent on face 0').toBeUndefined();
    settle(g);
    expect(life(g), 'the front' + "'" + 's def').toBe(life0 + 1);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    expect(g.state.cards[self]?.faceIndex).toBe(1);
    activate(g, self);
    expect(g.state.stack.at(-1)?.abilityFace, 'the face it was activated from').toBe(1);
    settle(g);
    expect(life(g), 'the back' + "'" + 's def').toBe(life0 + 3);
    // Activated from the back, then turned to the front while it waits: the back's def resolves (CR 113.7a).
    activate(g, self);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    expect(g.state.cards[self]?.faceIndex).toBe(0);
    settle(g);
    expect(life(g), 'the back' + "'" + 's def, though the front is up now').toBe(life0 + 5);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a def tagged with the other face is never this face' + "'" + 's', () => {
    const { g, self } = staged(BACK_ONLY);
    const life0 = life(g);
    activate(g, self);
    settle(g);
    expect(life(g), 'the front has no def: the back' + "'" + 's is not asked').toBe(life0);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    activate(g, self);
    settle(g);
    expect(life(g), 'the back' + "'" + 's def on the back').toBe(life0 + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a transforms-into trigger fires on the flip into its face alone', () => {
    const { g, self } = staged(TURNED);
    const life0 = life(g);
    expect(life(g), 'entering on the front fires nothing').toBe(life0);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    expect(life(g), 'turned into the back').toBe(life0 + 3);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    expect(life(g), 'turned back to the front: the back' + "'" + 's trigger is off').toBe(life0 + 3);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    expect(life(g), 'into the back again').toBe(life0 + 6);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

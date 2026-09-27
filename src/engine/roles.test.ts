// D574 - ROLE TOKENS (CR 303.7). A Role is an Aura token created ATTACHED to the object its clause names; the card
// database holds the Roles only as double-faced token printings, so the Role table names the printing AND the face. What
// is proven here: the reading (a target, a payload's `it` as the source, D392's referent, the pool loader; Royal refused);
// a Role enters attached in the batch that creates it, as the face the table names; the source form; the one-Role rule
// (a newer Role of the same player replaces the older, another player's stays); no Role when its host is gone; the replay
// hash on each.
import { describe, expect, test } from 'vitest';
import { HILL_GIANT, LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { ROLE_TABLE } from '../data/roleTable';
import { tokenPrintingIdsIn } from '../data/tokenParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { MONSTER_SORCERER_ROLE_SCRIPT } from './scripts/cards/monsterSorcererRole';
import { MONSTER_VIRTUOUS_ROLE_SCRIPT } from './scripts/cards/monsterVirtuousRole';
import { WICKED_CURSED_ROLE_SCRIPT } from './scripts/cards/wickedCursedRole';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardData } from '../data/cardTypes';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { ScriptRegistry } from './scripts/registry';

const ROLES = [MONSTER_SORCERER_ROLE_SCRIPT, WICKED_CURSED_ROLE_SCRIPT, MONSTER_VIRTUOUS_ROLE_SCRIPT];

/** A test carrier: the card's enter trigger resolves `payload` through the vocabulary. */
function makerOn(carrier: CardData, payload: string): CardScript {
  const effects = vocabularyEffects(payload, carrier.name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: carrier.oracleId,
    name: carrier.name,
    triggers: [
      {
        abilityId: 'etb-role',
        text: 'When this creature enters, ' + payload,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        targets,
        label: () => `${carrier.name} - ${payload}`,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}
const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
function game(scripts: ScriptRegistry, p1: readonly string[], p2: readonly string[] = []): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...ISLANDS], [...p2, ...ISLANDS]], scripts, options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
/** The Roles on the battlefield attached to `host`, oldest first. */
const rolesOn = (g: Game, host: InstanceId) => g.state.zones.battlefield.filter((id) => { const c = g.state.cards[id]; return c?.isToken === true && c.attachedTo === host && derive(g.state, ORACLE, g.deps.scripts, id).typeLine.subtypes.includes('Role'); });
const pt = (g: Game, id: InstanceId) => { const d = derive(g.state, ORACLE, g.deps.scripts, id); return [d.power, d.toughness]; };

describe('D574 - Role tokens', () => {
  test('the reading: a target, the source, the referent, the pool loader; Royal is not read', () => {
    const aimed = vocabularyEffects('Create a Monster Role token attached to target creature you control.', 'x');
    expect(aimed.map((e) => [e.kind, e.attach, e.tokenFace, e.targetIndex, e.token?.name])).toEqual([['createToken', 'aim', 0, 0, 'Monster Role']]);
    expect(vocabularyTargets('Create a Monster Role token attached to target creature you control.')).toHaveLength(1);
    const own = vocabularyEffects('create a Cursed Role token attached to it.', 'x');
    expect(own.map((e) => [e.kind, e.attach, e.tokenFace, e.self, e.token?.name])).toEqual([['createToken', 'source', 1, true, 'Cursed Role']]);
    const referent = vocabularyEffects('Target creature gets +2/+0 until end of turn. Create a Monster Role token attached to it.', 'x');
    expect(referent.map((e) => [e.kind, e.targetIndex, e.attach ?? null])).toEqual([['pump', 0, null], ['createToken', 0, 'aim']]);
    expect(() => vocabularyEffects('Create a Royal Role token attached to target creature you control.', 'x')).toThrow();
    const card = { faces: [{ oracleText: 'Create a Wicked Role token attached to target creature you control.' }] } as unknown as CardData;
    expect(tokenPrintingIdsIn([card])).toContain(ROLE_TABLE['Wicked']?.printingId);
  });

  test('a Role enters attached in the batch that creates it, as the face the table names', () => {
    const scripts = createRegistry([...ROLES, makerOn(LLANOWAR_ELVES, 'Create a Monster Role token attached to target creature you control.')]);
    const g = game(scripts, ['Grizzly Bears', 'Llanowar Elves']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    main(g, 1);
    put(g, 'p1', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const [role] = rolesOn(g, bears);
    expect(role, 'the Monster Role on the Bears').toBeDefined();
    if (!role) return;
    expect([g.state.cards[role]?.printingId, g.state.cards[role]?.faceIndex, g.state.cards[role]?.controller]).toEqual([ROLE_TABLE['Monster']?.printingId, 0, 'p1']);
    expect(derive(g.state, ORACLE, scripts, role).name).toBe('Monster');
    const made = g.log.findIndex((e) => e.body.t === 'TokenCreated' && e.body.card === role);
    const attached = g.log.findIndex((e) => e.body.t === 'AttachmentChanged' && e.body.card === role);
    expect(attached, 'attached in the same batch').toBe(made + 1);
    expect(pt(g, bears)).toEqual([3, 3]);
    expect(derive(g.state, ORACLE, scripts, bears).keywords.has('trample')).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the source form: When this creature enters, create a Cursed Role token attached to it', () => {
    const scripts = createRegistry([...ROLES, makerOn(HILL_GIANT, 'create a Cursed Role token attached to it.')]);
    const g = game(scripts, ['Hill Giant']);
    main(g, 1);
    const giant = put(g, 'p1', 'Hill Giant');
    settle(g);
    expect(rolesOn(g, giant)).toHaveLength(1);
    expect(pt(g, giant), 'base 1/1').toEqual([1, 1]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the one-Role rule: a newer Role of the same player replaces the older; another player' + String.fromCharCode(39) + 's stays', () => {
    const scripts = createRegistry([...ROLES, makerOn(LLANOWAR_ELVES, 'Create a Monster Role token attached to target creature you control.'), makerOn(HILL_GIANT, 'Create a Wicked Role token attached to target creature.')]);
    const g = game(scripts, ['Grizzly Bears', 'Llanowar Elves', 'Llanowar Elves'], ['Hill Giant']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    main(g, 1);
    for (let i = 0; i < 2; i++) {
      put(g, 'p1', 'Llanowar Elves');
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
      settle(g);
    }
    const mine = rolesOn(g, bears);
    expect(mine, 'one Monster Role - the newer').toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.body.card !== mine[0] && e.body.printingId === ROLE_TABLE['Monster']?.printingId), 'the older one was made').toBe(true);
    expect(pt(g, bears)).toEqual([3, 3]);
    put(g, 'p2', 'Hill Giant');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const both = rolesOn(g, bears);
    expect(both.map((id) => g.state.cards[id]?.controller).sort(), 'p1' + String.fromCharCode(39) + 's Monster and p2' + String.fromCharCode(39) + 's Wicked').toEqual(['p1', 'p2']);
    expect(pt(g, bears)).toEqual([4, 4]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('no Role when its host is gone as the clause resolves', () => {
    const scripts = createRegistry([...ROLES, makerOn(HILL_GIANT, 'create a Cursed Role token attached to it.')]);
    const g = game(scripts, ['Hill Giant']);
    main(g, 1);
    const giant = put(g, 'p1', 'Hill Giant');
    advanceUntil(g, (s) => s.stack.length === 1, 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'TokenCreated'), 'no token').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D574 - `Monster // Sorcerer`, the Role token script: Monster (+1/+1 and trample) and Sorcerer (+1/+1 and "Whenever this
// creature attacks, scry 1." - the granted trigger fires off the enchanted creature). Each Role is made through the
// vocabulary by a test carrier's enter trigger; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { MONSTER_SORCERER_ROLE_SCRIPT } from './monsterSorcererRole';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { CardScript } from '../api';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function makerOn(payload: string): CardScript {
  const effects = vocabularyEffects(payload, LLANOWAR_ELVES.name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: LLANOWAR_ELVES.oracleId,
    name: LLANOWAR_ELVES.name,
    triggers: [
      {
        abilityId: 'etb-role',
        text: 'When this creature enters, ' + payload,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        targets,
        label: () => `Llanowar Elves - ${payload}`,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}
const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
function roled(role: 'Monster' | 'Sorcerer'): { g: Game; bears: InstanceId } {
  const scripts = createRegistry([MONSTER_SORCERER_ROLE_SCRIPT, makerOn(`Create a ${role} Role token attached to target creature you control.`)]);
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Llanowar Elves', ...ISLANDS], [...ISLANDS]], scripts, options: { maxHandSize: null } });
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  advanceUntil(g, (s) => s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
  put(g, 'p1', 'Llanowar Elves');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
  return { g, bears };
}

describe('Monster // Sorcerer - the Role token', () => {
  test('Monster: the enchanted creature gets +1/+1 and has trample', () => {
    const { g, bears } = roled('Monster');
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect([d.power, d.toughness, d.keywords.has('trample')]).toEqual([3, 3, true]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Sorcerer: +1/+1, and the enchanted creature scries 1 whenever it attacks', () => {
    const { g, bears } = roled('Sorcerer');
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect([d.power, d.toughness, d.keywords.has('trample')]).toEqual([3, 3, false]);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'declareAttackers' && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice' || s.turn.step === 'combatDamage', 20_000);
    expect(g.state.priority.awaiting?.kind, 'the granted trigger asks the scry').toBe('scryChoice');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

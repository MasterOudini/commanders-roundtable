// D575 - `Royal // Young Hero`, the Role token script: Royal (+1/+1 and a granted ward {1} - the derived ward the tax reads)
// and Young Hero (the enchanted creature's attack puts a +1/+1 counter on it while its toughness is 3 or less). Each Role
// is made through the vocabulary by a test carrier's enter trigger; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GLORIOUS_ANTHEM_SCRIPT } from './gloriousAnthem';
import { ROYAL_YOUNG_HERO_ROLE_SCRIPT } from './royalYoungHeroRole';
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
function roled(role: 'Royal' | 'Young Hero', host: string, extra: readonly string[] = []): { g: Game; target: InstanceId } {
  const scripts = createRegistry([ROYAL_YOUNG_HERO_ROLE_SCRIPT, GLORIOUS_ANTHEM_SCRIPT, makerOn(`Create a ${role} Role token attached to target creature you control.`)]);
  const g = startedGame({ players: 2, decks: [[host, 'Llanowar Elves', ...extra, ...ISLANDS], [...ISLANDS]], scripts, options: { maxHandSize: null } });
  holdEverywhere(g);
  const target = put(g, 'p1', host);
  for (const name of extra) put(g, 'p1', name);
  advanceUntil(g, (s) => s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
  put(g, 'p1', 'Llanowar Elves');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
  return { g, target };
}
const attackWith = (g: Game, id: InstanceId) => {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'declareAttackers' && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: id, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.turn.step === 'declareBlockers' || s.turn.step === 'combatDamage' || s.turn.step === 'endCombat', 20_000);
};

describe('Royal // Young Hero - the Role token', () => {
  test('Royal: +1/+1 and a granted ward {1} on the enchanted creature', () => {
    const { g, target } = roled('Royal', 'Grizzly Bears');
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, target);
    expect([d.power, d.toughness]).toEqual([3, 3]);
    expect(d.wards.map((w) => [w.wardCost?.raw, w.wardLife])).toEqual([['{1}', 0]]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Young Hero: a 2/2 attacking gets a +1/+1 counter', () => {
    const { g, target } = roled('Young Hero', 'Grizzly Bears');
    attackWith(g, target);
    expect(g.state.cards[target]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Young Hero: a creature of toughness 4 attacks for nothing (the intervening if)', () => {
    const { g, target } = roled('Young Hero', 'Hill Giant', ['Glorious Anthem']);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, target).toughness).toBe(4);
    attackWith(g, target);
    expect(g.state.cards[target]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

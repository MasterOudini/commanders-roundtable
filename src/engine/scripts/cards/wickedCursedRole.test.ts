// D574 - `Wicked // Cursed`, the Role token script: Wicked (+1/+1, and each opponent loses 1 life as it goes to a
// graveyard from the battlefield - here when its host dies and the Aura falls) and Cursed (base power and toughness 1/1,
// under the pumps that come after it). Each Role is made through the vocabulary by a test carrier; the replay hash.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GLORIOUS_ANTHEM_SCRIPT } from './gloriousAnthem';
import { WICKED_CURSED_ROLE_SCRIPT } from './wickedCursedRole';
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
function roled(role: 'Wicked' | 'Cursed', host: string, extra: readonly string[] = []): { g: Game; target: InstanceId } {
  const scripts = createRegistry([WICKED_CURSED_ROLE_SCRIPT, GLORIOUS_ANTHEM_SCRIPT, makerOn(`Create a ${role} Role token attached to target creature you control.`)]);
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
const pt = (g: Game, id: InstanceId) => { const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return [d.power, d.toughness]; };

describe('Wicked // Cursed - the Role token', () => {
  test('Wicked: +1/+1, and each opponent loses 1 life when it goes to the graveyard with its host', () => {
    const { g, target } = roled('Wicked', 'Grizzly Bears');
    expect(pt(g, target)).toEqual([3, 3]);
    const life0 = g.state.players['p2']?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: target, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(Object.values(g.state.cards).some((c) => c.isToken === true && c.zone.kind === 'battlefield'), 'the Aura fell with its host').toBe(false);
    expect((g.state.players['p2']?.life ?? 0) - life0, 'each opponent loses 1 life').toBe(-1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Cursed: the enchanted creature has base power and toughness 1/1 - the anthem still pumps it', () => {
    const { g, target } = roled('Cursed', 'Hill Giant', ['Glorious Anthem']);
    expect(pt(g, target), 'base 1/1, then +1/+1').toEqual([2, 2]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

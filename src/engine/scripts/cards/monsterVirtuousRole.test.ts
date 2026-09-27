// D574 - `Monster // Virtuous`, the Role token script: Virtuous (+1/+1 for each enchantment its controller controls -
// the Role itself among them, counted at each derive). The Role is made through the vocabulary by a test carrier; the
// replay hash.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GLORIOUS_ANTHEM_SCRIPT } from './gloriousAnthem';
import { MONSTER_VIRTUOUS_ROLE_SCRIPT } from './monsterVirtuousRole';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { CardScript } from '../api';

const PAYLOAD = 'Create a Virtuous Role token attached to target creature you control.';
const EFFECTS = vocabularyEffects(PAYLOAD, LLANOWAR_ELVES.name);
const TARGETS = vocabularyTargets(PAYLOAD);
const MAKER: CardScript = {
  oracleId: LLANOWAR_ELVES.oracleId,
  name: LLANOWAR_ELVES.name,
  triggers: [
    {
      abilityId: 'etb-role',
      text: 'When this creature enters, ' + PAYLOAD,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      targets: TARGETS,
      label: () => `Llanowar Elves - ${PAYLOAD}`,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, EFFECTS, TARGETS),
    },
  ],
};
const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];

describe('Monster // Virtuous - the Role token', () => {
  test('Virtuous: +1/+1 for each enchantment you control - the anthem and the Role itself', () => {
    const scripts = createRegistry([MONSTER_VIRTUOUS_ROLE_SCRIPT, GLORIOUS_ANTHEM_SCRIPT, MAKER]);
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Glorious Anthem', 'Llanowar Elves', ...ISLANDS], [...ISLANDS]], scripts, options: { maxHandSize: null } });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Glorious Anthem');
    advanceUntil(g, (s) => s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
    put(g, 'p1', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    // 2/2 + the anthem's +1/+1 + two enchantments (the anthem and the Role).
    expect([d.power, d.toughness]).toEqual([5, 5]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

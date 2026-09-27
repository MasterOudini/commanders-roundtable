// D574 - THE DOESN'T-EXIST AUDIT, THE SCRIPTS' HALF (D573's residue, CR 702.26b). D573 swapped the engine's walks over the
// battlefield; the card modules walk it themselves (`inPlay(ctx.state)` now, and an all-cards walk skips a phased-out
// permanent beside one off the battlefield). What is proven: Helm of the Gods' count of the enchantments its controller
// controls stops counting a Glorious Anthem that phased out (while the other anthem and the Helm's own count of it stay),
// and counts it again when it phases in; the replay hash.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { GLORIOUS_ANTHEM_SCRIPT } from './scripts/cards/gloriousAnthem';
import { HELM_OF_THE_GODS_SCRIPT } from './scripts/cards/helmOfTheGods';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

// A test carrier: the Elves' enter trigger phases out a target permanent (the vocabulary's own reading).
const PHASE_TARGET = vocabularyEffects('Target permanent phases out.', LLANOWAR_ELVES.name);
const PHASE_TARGET_T = vocabularyTargets('Target permanent phases out.');
const PHASER: CardScript = {
  oracleId: LLANOWAR_ELVES.oracleId,
  name: LLANOWAR_ELVES.name,
  triggers: [
    {
      abilityId: 'etb-phase',
      text: 'When this creature enters, target permanent phases out.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      targets: PHASE_TARGET_T,
      label: () => 'Llanowar Elves - target permanent phases out',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, PHASE_TARGET, PHASE_TARGET_T),
    },
  ],
};
const SCRIPTS = createRegistry([GLORIOUS_ANTHEM_SCRIPT, HELM_OF_THE_GODS_SCRIPT, PHASER]);
const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
function game(p1: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...ISLANDS], [...ISLANDS]], scripts: SCRIPTS, options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const pt = (g: Game, id: InstanceId) => { const d = derive(g.state, ORACLE, SCRIPTS, id); return [d.power, d.toughness]; };

describe('D574 - the scripts do not count a phased-out permanent', () => {
  test('Helm of the Gods counts the enchantments in play: one anthem phased out is neither a pump nor a count', () => {
    const g = game(['Helm of the Gods', 'Grizzly Bears', 'Glorious Anthem', 'Glorious Anthem', 'Llanowar Elves']);
    const helm = put(g, 'p1', 'Helm of the Gods');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const anthemA = put(g, 'p1', 'Glorious Anthem');
    put(g, 'p1', 'Glorious Anthem');
    main(g, 1);
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: helm, to: bears }));
    // 2/2 + two anthems + the Helm's count of two enchantments.
    expect(pt(g, bears)).toEqual([6, 6]);
    put(g, 'p1', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: anthemA }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[anthemA]?.phasedOut).toBe(true);
    // One anthem's pump and one enchantment in the Helm's count: 2/2 + 1 + 1.
    expect(pt(g, bears), 'the phased-out anthem is neither a pump nor a count').toEqual([4, 4]);
    main(g, 3);
    expect(g.state.cards[anthemA]?.phasedOut).toBe(false);
    expect(pt(g, bears), 'phased in - counted again').toEqual([6, 6]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

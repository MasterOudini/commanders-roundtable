// D591 - THE PLURAL BOUNCE: `return up to two target creatures to their owners' hands` - the bounce spelled one owner
// (`to its owner's hand`), so a counted plural return was unread at any count. What is proven: the plural reads whole (the
// singular kept), the spec counted; a trigger's `return up to two target creatures to their owners' hands` returns both
// picks to their owners' hands - one of each player; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

/** An upkeep head on Grizzly Bears whose payload the vocabulary reads (the generated vocab shape). */
function head(payload: string): CardScript {
  const card = ORACLE.byName('Grizzly Bears');
  if (!card) throw new Error('Grizzly Bears is not in the fixtures');
  const effects = vocabularyEffects(payload, 'Grizzly Bears');
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: 'Grizzly Bears',
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Grizzly Bears - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe("D591 - the plural bounce: to their owners' hands", () => {
  test('the plural reads whole, the singular kept, the spec counted', () => {
    expect(parseEffects("Return up to two target creatures to their owners' hands.", 'Hoverguard Sweepers', true).mode).toBe('auto');
    expect(parseEffects("Return two target nonland permanents to their owners' hands.", 'X', true).mode).toBe('auto');
    expect(parseEffects("Return target creature to its owner's hand.", 'Unsummon', true).mode, 'the singular stays read').toBe('auto');
    const [two] = vocabularyTargets("Return up to two target creatures to their owners' hands.");
    expect([two?.min, two?.max]).toEqual([0, 2]);
  });

  test("a trigger returns up to two target creatures to their owners' hands: both picks, one of each player", () => {
    const payload = "Return up to two target creatures to their owners' hands.";
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Hill Giant', ...TEN], ['Walking Corpse', ...TEN]], scripts: createRegistry([head(payload)]) });
    settle(g);
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears');
    const giant = put(g, 'p1', 'Hill Giant');
    const corpse = put(g, 'p2', 'Walking Corpse');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: giant }, { kind: 'card', id: corpse }] }));
    settle(g);
    expect(g.state.cards[giant]?.zone).toMatchObject({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[corpse]?.zone).toMatchObject({ kind: 'hand', player: 'p2' });
    hashHolds(g);
  });
});

// D594 - THE EQUIPMENT'S OWN ATTACH: `When this Equipment enters, attach it to target creature you control.` (Skyclave
// Pick-Axe, Celestial Armor, Coral Sword, Galadhrim Bow, Mind Carver, Mithril Coat) - the vocabulary had no verb for the
// source attaching itself, so every such Equipment stayed blocked on its entry trigger. `attachSource` attaches the
// clause's source to its aim, asked again as it resolves: the source still on the battlefield and not phased out (a new
// object once it left - CR 400.7, D592's equip), and not itself a creature (CR 301.5c); the aim's legality is the
// resolution's own (CR 608.2b). What is proven: the vocabulary reads it whole; a trigger attaches the Greaves to the chosen
// creature; a Greaves gone before the trigger resolves attaches nothing; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { checkInvariants } from './invariants';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const GREAVES = 'Lightning Greaves';
const PAYLOAD = 'Attach ~ to target creature you control.';

/** An upkeep head on Lightning Greaves whose payload the vocabulary reads (the generated vocab shape). */
function head(): CardScript {
  const card = ORACLE.byName(GREAVES);
  if (!card) throw new Error('Lightning Greaves is not in the fixtures');
  const effects = vocabularyEffects(PAYLOAD, GREAVES);
  const targets = vocabularyTargets(PAYLOAD);
  return {
    oracleId: card.oracleId,
    name: GREAVES,
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => GREAVES + ' - ' + PAYLOAD,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
function armed(): { g: Game; greaves: string; bears: string } {
  const g = startedGame({ players: 2, decks: [[GREAVES, 'Grizzly Bears', ...TEN], ['Walking Corpse', ...TEN]], scripts: createRegistry([head()]) });
  settle(g);
  holdEverywhere(g);
  const greaves = put(g, 'p1', GREAVES);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, greaves, bears };
}

describe("D594 - the Equipment's own attach", () => {
  test('the vocabulary reads the source attaching itself to a target creature you control', () => {
    expect(vocabularyEffects(PAYLOAD, GREAVES).map((e) => e.kind)).toEqual(['attachSource']);
    const [spec] = vocabularyTargets(PAYLOAD);
    expect([spec?.min, spec?.max, spec?.controller]).toEqual([1, 1, 'you']);
  });

  test('a trigger attaches the Greaves to the chosen creature', () => {
    const { g, greaves, bears } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[greaves]?.attachedTo).toBe(bears);
    expect(g.state.cards[bears]?.attachments).toContain(greaves);
    expect(checkInvariants(g.state)).toEqual([]);
    hashHolds(g);
  });

  test('a Greaves gone before the trigger resolves attaches nothing (CR 400.7)', () => {
    const { g, greaves, bears } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: greaves, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[greaves]?.attachedTo).toBeNull();
    expect(g.state.cards[bears]?.attachments).not.toContain(greaves);
    expect(checkInvariants(g.state)).toEqual([]);
    hashHolds(g);
  });
});

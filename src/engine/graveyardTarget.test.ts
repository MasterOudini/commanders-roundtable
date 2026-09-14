// D436 - THE GRAVEYARD-CARD TARGET: `Exile target card from a graveyard.` (any graveyard), `... from your graveyard`,
// `... from an opponent's graveyard`, and `Put target card from a graveyard on the bottom of its owner's library.` -
// the target parser names the zone, the owner and the noun; the effect moves the aimed card out of its graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** An upkeep head aimed by its own targets (the generated vocab shape). */
function head(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
const ANY = head('Grizzly Bears', 'Exile target card from a graveyard.');
const YOURS = head('Coral Eel', 'Exile target creature card from your graveyard.');
const BOTTOM = head('Grizzly Bears', "Put target card from a graveyard on the bottom of its owner's library.");
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

function armed(script: CardScript, name: string): Game {
  const g = startedGame({ players: 2, decks: [[name, 'Raging Goblin', ...TEN], ['Walking Corpse', 'Cyclops of One-Eyed Pass', ...TEN]], scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', name);
  settle(g);
  return g;
}
function atPrompt(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
}
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone;

describe('the graveyard-card target (D436)', () => {
  test('the vocabulary reads the exile out of any, your or an opponent\'s graveyard, counted, and the bottom', () => {
    const any = parseEffects('Exile target card from a graveyard.', 'Purge', true);
    expect(any.mode).toBe('auto');
    expect(any.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['exileFromGraveyard', 0]]);
    expect(parseEffects("Exile target creature card from an opponent's graveyard.", 'Mummy', true).mode).toBe('auto');
    expect(parseEffects('Exile up to one target card from a graveyard.', 'Wolf', true).mode).toBe('auto');
    expect(parseEffects('Exile target instant or sorcery card from your graveyard.', 'Scholar', true).mode).toBe('auto');
    const bottom = parseEffects("Put target card from a graveyard on the bottom of its owner's library.", 'Sentinel', true);
    expect(bottom.mode).toBe('auto');
    expect(bottom.effects.map((e) => e.kind)).toEqual(['graveyardToLibraryBottom']);
    // The aim carries the zone and the owner: `a graveyard` names no owner, `your` names the controller.
    expect(vocabularyTargets('Exile target card from a graveyard.').map((t) => [t.zones, t.controller])).toEqual([[['graveyard'], 'any']]);
    expect(vocabularyTargets('Exile target creature card from your graveyard.').map((t) => [t.zones, t.controller, t.cardTypes])).toEqual([[['graveyard'], 'you', ['Creature']]]);
  });

  test("exiles the aimed card out of an opponent's graveyard", () => {
    const g = armed(ANY, 'Grizzly Bears');
    const corpse = put(g, 'p2', 'Walking Corpse', 'graveyard');
    settle(g);
    atPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }));
    settle(g);
    expect(zoneOf(g, corpse)).toEqual({ kind: 'exile', player: 'p2' });
    expect((g.state.zones.graveyard.p2 ?? []).includes(corpse)).toBe(false);
  });

  test("`your graveyard` refuses an opponent's card and takes the controller's creature card", () => {
    const g = armed(YOURS, 'Coral Eel');
    const corpse = put(g, 'p2', 'Walking Corpse', 'graveyard');
    const goblin = put(g, 'p1', 'Raging Goblin', 'graveyard');
    settle(g);
    atPrompt(g);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: goblin }] }));
    settle(g);
    expect(zoneOf(g, goblin)).toEqual({ kind: 'exile', player: 'p1' });
    expect(zoneOf(g, corpse)).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test("puts the aimed card on the bottom of its owner's library", () => {
    const g = armed(BOTTOM, 'Grizzly Bears');
    const corpse = put(g, 'p2', 'Walking Corpse', 'graveyard');
    settle(g);
    atPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }));
    settle(g);
    expect(zoneOf(g, corpse)).toEqual({ kind: 'library', player: 'p2' });
    // The bottom is the FRONT of the array.
    expect((g.state.zones.library.p2 ?? [])[0]).toBe(corpse);
  });

  test('replays to the same hash', () => {
    const g = armed(ANY, 'Grizzly Bears');
    const corpse = put(g, 'p2', 'Walking Corpse', 'graveyard');
    settle(g);
    atPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

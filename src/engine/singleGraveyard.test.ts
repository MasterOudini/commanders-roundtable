// D588 - THE GRAVEYARD TARGET GRAMMAR: `from a single graveyard` / `from a player's graveyard` (one graveyard every pick
// shares - enforced across the picks by validateTargets, no longer merely recorded) and `from graveyards` (any graveyard),
// with counts up to four and five. The effect vocabulary reads the exile out of them (Rapid Decay, Decompose, Scarab Feast,
// Shred Memory, Rooftop Percher's payload). What is proven: the parse (auto, the spec's singleGraveyard, nothing left
// unenforced); a trigger's `up to three target cards from a single graveyard` exiles two cards of ONE graveyard and refuses a
// declaration across two; `from graveyards` takes one card of each; `up to four` counts four; the replay hash on each.
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
function armed(payload: string): Game {
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Raging Goblin', 'Coral Eel', ...TEN], ['Walking Corpse', 'Cyclops of One-Eyed Pass', 'Hill Giant', 'Llanowar Elves', ...TEN]], scripts: createRegistry([head(payload)]) });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return g;
}
const atPrompt = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;

describe('D588 - the graveyard target grammar: one graveyard for every pick, any graveyard, four and five', () => {
  test('the vocabulary reads the exile from a single graveyard, from graveyards, up to four', () => {
    expect(parseEffects('Exile up to three target cards from a single graveyard.', 'Rapid Decay', true).mode).toBe('auto');
    expect(parseEffects('Exile up to two target cards from graveyards.', 'Rooftop Percher', true).mode).toBe('auto');
    expect(parseEffects('Exile up to four target cards from a single graveyard.', 'Shred Memory', true).mode).toBe('auto');
    const [single] = vocabularyTargets('Exile up to three target cards from a single graveyard.');
    expect(single?.zones).toEqual(['graveyard']);
    expect([single?.min, single?.max]).toEqual([0, 3]);
    expect(single?.singleGraveyard, 'one graveyard for every pick - enforced').toBe(true);
    expect(single?.unenforced, 'enforced, so no longer recorded').toEqual([]);
    const [any] = vocabularyTargets('Exile up to two target cards from graveyards.');
    expect(any?.singleGraveyard, 'any graveyard: no cross-pick rule').toBeUndefined();
    expect(any?.unenforced).toEqual([]);
  });

  test('up to three from a single graveyard: two cards of one graveyard are exiled; a declaration across two is refused', () => {
    const g = armed('Exile up to three target cards from a single graveyard.');
    const corpse = put(g, 'p2', 'Walking Corpse', 'graveyard');
    const giant = put(g, 'p2', 'Hill Giant', 'graveyard');
    const eel = put(g, 'p1', 'Coral Eel', 'graveyard');
    atPrompt(g);
    const across = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }, { kind: 'card', id: eel }] });
    expect(across.ok, 'two graveyards: refused').toBe(false);
    expect(across.ok ? '' : across.message).toContain('single graveyard');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }, { kind: 'card', id: giant }] }));
    settle(g);
    expect(zoneOf(g, corpse)).toBe('exile');
    expect(zoneOf(g, giant)).toBe('exile');
    expect(zoneOf(g, eel)).toBe('graveyard');
    hashHolds(g);
  });

  test('up to two from graveyards: one card of each graveyard is exiled', () => {
    const g = armed('Exile up to two target cards from graveyards.');
    const corpse = put(g, 'p2', 'Walking Corpse', 'graveyard');
    const eel = put(g, 'p1', 'Coral Eel', 'graveyard');
    atPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }, { kind: 'card', id: eel }] }));
    settle(g);
    expect(zoneOf(g, corpse)).toBe('exile');
    expect(zoneOf(g, eel)).toBe('exile');
    hashHolds(g);
  });

  test('up to four from a single graveyard: four cards of one graveyard are exiled', () => {
    const g = armed('Exile up to four target cards from a single graveyard.');
    const picks = [put(g, 'p2', 'Walking Corpse', 'graveyard'), put(g, 'p2', 'Hill Giant', 'graveyard'), put(g, 'p2', 'Llanowar Elves', 'graveyard'), put(g, 'p2', 'Cyclops of One-Eyed Pass', 'graveyard')];
    atPrompt(g);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: picks.map((id) => ({ kind: 'card' as const, id })) }));
    settle(g);
    for (const id of picks) expect(zoneOf(g, id)).toBe('exile');
    hashHolds(g);
  });
});

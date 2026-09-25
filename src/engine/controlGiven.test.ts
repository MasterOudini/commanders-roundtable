// D532 - CONTROL'S OTHER FORMS (CR 108.4, 613.7). The compound threaten (`Untap target creature and gain control of it
// until end of turn.` - D426's split with `gain control of it` now a referent object verb); control GIVEN to a named
// player (`giveControl` - `Target opponent gains control of ~.`, `Target player gains control of target ... you
// control.`); owners taking back what they own (`ownersControl` - `Each player gains control of all creatures they
// own.`, `Gain control of all permanents you own.`); and the repair: a LATER control change drops the cleanup revert an
// earlier until-end-of-turn one left, so the cleanup step no longer hands the permanent back over the newer effect.
// What is proven here: the parse of every form; Threaten in play (untapped, taken, back at cleanup); a threatened
// creature given on to a third player stays with that player past cleanup; Humble Defector's text giving the source
// away; Homeward Path's text returning a stolen creature to its owner; Brand bringing back only the caster's own.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { PlayerId } from './types/ids';
import type { TargetChoice } from './types/state';
import { BAZAAR_TRADER, HOMEWARD_PATH, HUMBLE_DEFECTOR } from '../data/fixtures/engineCards';

type TriggerDef = NonNullable<CardScript['triggers']>[number];
/** An enters trigger carrying a vocabulary payload - the effect under proof, whatever the card's own cost is. */
function enters(card: { readonly name: string }, payload: string): TriggerDef {
  const V = vocabularyEffects(payload, card.name);
  const T = vocabularyTargets(payload);
  return {
    abilityId: 'etb-proof',
    text: payload,
    event: 'CardsMoved',
    activeZones: ['battlefield'],
    optional: false,
    targets: T,
    matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
    label: () => `${card.name} - ${payload}`,
    resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, V, T),
  };
}
const REG = createRegistry([
  { oracleId: BAZAAR_TRADER.oracleId, name: BAZAAR_TRADER.name, triggers: [enters(BAZAAR_TRADER, 'Target player gains control of target artifact, creature, or land you control.')] },
  { oracleId: HUMBLE_DEFECTOR.oracleId, name: HUMBLE_DEFECTOR.name, triggers: [enters(HUMBLE_DEFECTOR, 'Target opponent gains control of ~.')] },
  { oracleId: HOMEWARD_PATH.oracleId, name: HOMEWARD_PATH.name, triggers: [enters(HOMEWARD_PATH, 'Each player gains control of all creatures they own.')] },
]);

const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const mainOf = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === s.turn.activePlayer && s.priority.awaiting === null, 60_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const aim = (g: Game, player: PlayerId, targets: readonly TargetChoice[]) => {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player, targets }));
};
const addMana = (g: Game, player: PlayerId, symbols: string) => {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: s as 'R' | 'C', amount: 1 }));
};

function game(players: 2 | 3): Game {
  const lands = (n: number) => Array.from({ length: n }, () => 'Mountain');
  const decks: string[][] = [
    ['Threaten', 'Act of Treason', 'Bazaar Trader', 'Humble Defector', 'Homeward Path', 'Brand', 'Grizzly Bears', ...lands(12)],
    ['Cyclops of One-Eyed Pass', 'Grizzly Bears', ...lands(10)],
  ];
  if (players === 3) decks.push(['Grizzly Bears', ...lands(10)]);
  const g = startedGame({ players, decks, scripts: REG, options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}

describe("D532 - control's other forms", () => {
  test('the parse: the compound threaten, the give-away, the owners', () => {
    const threaten = faceNamed('Threaten');
    expect(threaten.effectMode).toBe('auto');
    expect(threaten.effects.map((e) => e.kind)).toEqual(['untap', 'control', 'pump']);
    expect(threaten.effects.map((e) => e.targetIndex)).toEqual([0, 0, 0]);
    const v = (t: string) => vocabularyEffects(t, 'X')[0];
    expect(v('Target opponent gains control of ~.')).toMatchObject({ kind: 'giveControl', targetIndex: 0 });
    expect(v('Target opponent gains control of ~.')?.otherTargetIndex).toBeUndefined();
    expect(v('Target player gains control of target artifact, creature, or land you control.')).toMatchObject({ kind: 'giveControl', targetIndex: 0, otherTargetIndex: 1 });
    expect(v('Each player gains control of all creatures they own.')).toMatchObject({ kind: 'ownersControl' });
    expect(v('Each player gains control of all creatures they own.')?.ownersYou).toBeUndefined();
    const brand = faceNamed('Brand');
    expect(brand.effectMode).toBe('auto');
    expect(brand.effects[0]).toMatchObject({ kind: 'ownersControl', ownersYou: true });
  });

  test('Threaten untaps the creature and takes it; cleanup hands it back', () => {
    const g = game(2);
    const threaten = put(g, 'p1', 'Threaten', 'hand');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    mainOf(g, 3);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [cyclops], tapped: true }));
    addMana(g, 'p1', 'CCR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: threaten, targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.controller).toBe('p1');
    expect(g.state.cards[cyclops]?.tapped, 'untapped').toBe(false);
    mainOf(g, 4);
    expect(g.state.cards[cyclops]?.controller, 'back with p2 after cleanup').toBe('p2');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a threatened creature given on to a third player stays with that player past cleanup', () => {
    const g = game(3);
    const treason = put(g, 'p1', 'Act of Treason', 'hand');
    const trader = put(g, 'p1', 'Bazaar Trader', 'graveyard');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    mainOf(g, 4);
    addMana(g, 'p1', 'CCR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: treason, targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.controller).toBe('p1');
    expect(g.state.untilEndOfTurn.some((m) => m.card === cyclops && m.controlRevert === 'p2'), 'the threaten remembers p2').toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: trader, to: { kind: 'battlefield', player: 'p1' } }));
    aim(g, 'p1', [{ kind: 'player', id: 'p3' }, { kind: 'card', id: cyclops }]);
    settle(g);
    expect(g.state.cards[cyclops]?.controller, 'given to p3').toBe('p3');
    expect(g.state.untilEndOfTurn.some((m) => m.card === cyclops && m.controlRevert !== undefined), 'the older revert is gone').toBe(false);
    mainOf(g, 5);
    expect(g.state.cards[cyclops]?.controller, 'the newer control outlasts the cleanup').toBe('p3');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Humble Defector's text gives the source to the opponent", () => {
    const g = game(2);
    const defector = put(g, 'p1', 'Humble Defector', 'graveyard');
    mainOf(g, 3);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: defector, to: { kind: 'battlefield', player: 'p1' } }));
    aim(g, 'p1', [{ kind: 'player', id: 'p2' }]);
    settle(g);
    expect(g.state.cards[defector]?.controller).toBe('p2');
    expect(g.log.filter((e) => e.body.t === 'ControlGained').length).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Homeward Path's text returns a stolen creature to its owner", () => {
    const g = game(2);
    const path = put(g, 'p1', 'Homeward Path', 'graveyard');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    mainOf(g, 3);
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: cyclops, controller: 'p1' }));
    expect(g.state.cards[cyclops]?.controller).toBe('p1');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: path, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[cyclops]?.controller, 'back with its owner').toBe('p2');
    expect(g.log.some((e) => e.body.t === 'ScopeWalked' && e.body.verb === 'ownersControl' && e.body.members === 1)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Brand brings back only the caster's own", () => {
    const g = game(2);
    const brand = put(g, 'p1', 'Brand', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    mainOf(g, 3);
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: bears, controller: 'p2' }));
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: cyclops, controller: 'p1' }));
    addMana(g, 'p1', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: brand, targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.controller, "p1's own comes back").toBe('p1');
    expect(g.state.cards[cyclops]?.controller, "p2's stays where it is").toBe('p1');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D428 - THE TRIGGERING PLAYER (`TriggerDef.playerOf`): a head whose event names one player ("Whenever
// this creature deals combat damage to a player, that player ...", "At the beginning of each upkeep,
// that player ...") carries that player onto the pending trigger and the stack object, so the def's
// payload aims its one clause there without asking. A head that names nobody fires nothing; a
// per-item head names one player per item.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript, TriggerDef } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** A def whose payload is read by the vocabulary as `target player ...`, aimed at the triggering player. */
function referent(name: string, payload: string, def: Pick<TriggerDef, 'event' | 'matches' | 'playerOf' | 'perItem' | 'looksBack'>): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'referent-0',
      text: card.faces[0]?.oracleText ?? '',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      label: () => name + ' - ' + payload,
      ...def,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, effects, targets);
      },
    }],
  };
}
const BEARS = referent('Grizzly Bears', 'Target player loses 2 life.', {
  event: 'CombatDamageDealt',
  matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
  playerOf: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' ? (ev.damages.find((d) => d.source === self && d.target.kind === 'player' && d.amount > 0)?.target.id ?? null) : null),
});
// An upkeep head whose `playerOf` names nobody: the trigger never reaches the stack.
const NOBODY = referent('Coral Eel', 'Target player loses 1 life.', {
  event: 'StepBegan',
  matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
  playerOf: () => null,
});
// "Whenever a creature dies, that creature's controller loses 1 life." - one firing per creature, each naming its controller.
const WATCHER = referent('Cyclops of One-Eyed Pass', 'Target player loses 1 life.', {
  event: 'CardsMoved',
  looksBack: true,
  matches: (ctx, _self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
  perItem: (ctx, _self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
  playerOf: (ctx, _self, _ev, item) => (item !== undefined ? (ctx.state.cards[item]?.controller ?? null) : null),
});

function stacked(g: Game, source: string): readonly (string | undefined)[] {
  return g.log.flatMap((e) => (e.body.t === 'AbilityPutOnStack' && e.body.obj.source === source ? [e.body.obj.player] : []));
}

describe('the triggering player (D428)', () => {
  test('a combat-damage head names the damaged player, and the payload aims there unasked', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], []], scripts: createRegistry([BEARS]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const life0 = g.state.players.p2?.life ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain', 20_000);
    settle(g);
    expect(stacked(g, bears)).toEqual(['p2']);
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseTargets')).toBe(false);
    expect(g.state.players.p2?.life).toBe(life0 - 2 - 2);
    expect(g.state.players.p1?.life).toBe(life0);
  });

  test('a head that names nobody fires nothing', () => {
    const g = startedGame({ players: 2, decks: [['Coral Eel'], []], scripts: createRegistry([NOBODY]) });
    settle(g);
    holdEverywhere(g);
    const eel = put(g, 'p1', 'Coral Eel');
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain', 60_000);
    expect(stacked(g, eel)).toEqual([]);
    expect(g.state.players.p1?.life).toBe(life0);
    expect(g.state.players.p2?.life).toBe(life0);
  });

  test('a per-item head names each item its own player', () => {
    const g = startedGame({ players: 2, decks: [['Cyclops of One-Eyed Pass', 'Grizzly Bears'], ['Coral Eel']], scripts: createRegistry([WATCHER]) });
    settle(g);
    holdEverywhere(g);
    const watcher = put(g, 'p1', 'Cyclops of One-Eyed Pass');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const eel = put(g, 'p2', 'Coral Eel');
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: eel, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(stacked(g, watcher)).toEqual(['p2']);
    expect(g.state.players.p2?.life).toBe(life0 - 1);
    expect(g.state.players.p1?.life).toBe(life0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(stacked(g, watcher)).toEqual(['p2', 'p1']);
    expect(g.state.players.p1?.life).toBe(life0 - 1);
    expect(g.state.players.p2?.life).toBe(life0 - 1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], []], scripts: createRegistry([BEARS]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

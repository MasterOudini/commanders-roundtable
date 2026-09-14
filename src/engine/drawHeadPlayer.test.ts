// D432 - THE DRAW HEADS' PLAYER: `Whenever an opponent draws a card, ...` names the drawing player (`DrewCards.player`)
// once per card drawn, and the payload's `they` / `them` / `that player` is that player - Sheoldred's `they lose 2
// life`, Underworld Dreams' ping, and Smothering Tithe's `that player may pay {2}. If the player doesn't, you create a
// Treasure token` (the referent PAYER: the prompt goes to the drawing player, the Treasure to the controller).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** An opponent-draws trigger whose payload (rewritten to `target player`) is aimed at the drawing player, per card. */
function watcher(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'opponentDrawsCard-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      playerOf: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.player : null),
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player !== ctx.query.controllerOf(self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, effects, targets);
      },
    }],
  };
}
const DRAIN = watcher('Grizzly Bears', 'Target player loses 2 life.');
const TITHE = watcher('Coral Eel', "Target player may pay {2}. If the player doesn't, you create a Treasure token.");
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

function armed(script: CardScript, name: string): Game {
  const g = startedGame({ players: 2, decks: [[name, ...TEN], [...TEN]], scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', name);
  settle(g);
  return g;
}

describe("the draw heads' player (D432)", () => {
  test("the opponent's draw step names them, once per card", () => {
    const g = armed(DRAIN, 'Grizzly Bears');
    const life0 = g.state.players.p2?.life ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 2);
    // The controller's own draw is not an opponent's.
    const mine0 = g.state.players.p1?.life ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'draw', 20_000);
    settle(g);
    expect(g.state.players.p1?.life).toBe(mine0);
    const fired = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.player === 'p2').length;
    expect(fired).toBe(1);
  });

  test('the referent payer is asked, and declining makes the Treasure for the controller', () => {
    const g = armed(TITHE, 'Coral Eel');
    // The payer must be ABLE to pay or the unpaid branch runs unasked (CR 119.4's rule for the prompt): two lands.
    put(g, 'p2', 'Forest');
    put(g, 'p2', 'Forest');
    settle(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'payMana' ? ask.player : null).toBe('p2');
    const board0 = g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1').length;
    must(g.submit({ t: 'AnswerPayMana', player: 'p2', pay: false }));
    settle(g);
    const mine = g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1');
    expect(mine.length).toBe(board0 + 1);
    const treasure = mine.find((id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.faces[0]?.name === 'Treasure');
    expect(treasure).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = armed(TITHE, 'Coral Eel');
    put(g, 'p2', 'Forest');
    put(g, 'p2', 'Forest');
    settle(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    must(g.submit({ t: 'AnswerPayMana', player: 'p2', pay: false }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

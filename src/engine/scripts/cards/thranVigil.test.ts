// `Thran Vigil` — the graveyard-exit watcher gated on "during your turn".

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THRAN_VIGIL_SCRIPT } from './thranVigil';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VIGIL = 'Thran Vigil';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; corpse: InstanceId; land: InstanceId; aim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VIGIL, BEARS, BEARS, MOUNTAIN], []],
    scripts: createRegistry([THRAN_VIGIL_SCRIPT]),
  });
  put(g, 'p1', VIGIL);
  const aim = put(g, 'p1', BEARS);
  const corpse = put(g, 'p1', BEARS, 'graveyard');
  const land = put(g, 'p1', MOUNTAIN, 'graveyard');
  if (corpse === aim) throw new Error('the deck must hold two distinct Bears');
  settle(g);
  holdEverywhere(g);
  return { g, corpse, land, aim };
}

/** Pulls `card` out of the graveyard and answers the aim if one is raised. */
function raise(g: Game, card: InstanceId, aim: InstanceId): void {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
  if (g.state.priority.awaiting?.kind === 'chooseTargets') {
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: aim }] }));
  }
  settle(g);
}

function toMyTurn(g: Game): void {
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1', 60_000);
}

function toTheirTurn(g: Game): void {
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2', 60_000);
}

describe('Thran Vigil', () => {
  test('a CREATURE card leaving my graveyard on MY turn pays', () => {
    const { g, corpse, aim } = game();
    toMyTurn(g);
    raise(g, corpse, aim);
    expect(g.state.cards[aim]?.counters['+1/+1']).toBe(1);
  });

  test('the same exit on THEIR turn pays nothing — "during your turn" is the gate', () => {
    const { g, corpse, aim } = game();
    toTheirTurn(g);
    raise(g, corpse, aim);
    expect(g.state.cards[aim]?.counters['+1/+1']).toBeUndefined();
  });

  test('a LAND leaving pays nothing — the filter is artifact and/or creature', () => {
    const { g, land, aim } = game();
    toMyTurn(g);
    raise(g, land, aim);
    expect(g.state.cards[aim]?.counters['+1/+1']).toBeUndefined();
  });

  test('replays to the same hash', () => {
    const { g, corpse, aim } = game();
    toMyTurn(g);
    raise(g, corpse, aim);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

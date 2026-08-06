// `Akki Scrapchomper` — the OR-predicate over artifact-or-land with a tap in
// the cost: either arm pays, a creature never does.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AKKI_SCRAPCHOMPER_SCRIPT } from './akkiScrapchomper';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHOMPER = 'Akki Scrapchomper';
const FOUNTAIN = 'Radiant Fountain';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; chomper: InstanceId; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHOMPER, FOUNTAIN, BEARS], []],
    scripts: createRegistry([AKKI_SCRAPCHOMPER_SCRIPT]),
  });
  const chomper = put(g, 'p1', CHOMPER);
  const land = put(g, 'p1', FOUNTAIN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  // The {T} in the cost gates on summoning sickness (CR 302.6).
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, chomper, land, bears };
}

describe('Akki Scrapchomper', () => {
  test('the LAND arm pays, the Chomper turns, and the draw arrives', () => {
    const { g, chomper, land } = game();
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chomper, abilityIndex: 0, sacrifice: land }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(g.state.cards[chomper]?.tapped).toBe(true);
  });

  test('a CREATURE is neither artifact nor land and cannot pay', () => {
    const { g, chomper, bears } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: chomper, abilityIndex: 0, sacrifice: bears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, chomper, land } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chomper, abilityIndex: 0, sacrifice: land }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

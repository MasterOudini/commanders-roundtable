// `Niv-Mizzet, the Firemind` — my draw step's draw asks a ping; the tap
// draws and pings again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIV_MIZZET_THE_FIREMIND_SCRIPT } from './nivMizzetTheFiremind';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const NIV = 'Niv-Mizzet, the Firemind';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Niv on turn 1; the turn-3 draw step's ping asked and answered at the opponent. */
function primed(): { g: Game; niv: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[NIV], []],
    scripts: createRegistry([NIV_MIZZET_THE_FIREMIND_SCRIPT]),
  });
  const niv = put(g, 'p1', NIV);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, niv };
}

describe('Niv-Mizzet, the Firemind', () => {
  test("the draw step's draw pings the opponent for 1", () => {
    const { g } = primed();
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('{T}: draw a card, and that draw pings too', () => {
    const { g, niv } = primed();
    advanceUntil(g, (s) => s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: niv, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[niv]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = primed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

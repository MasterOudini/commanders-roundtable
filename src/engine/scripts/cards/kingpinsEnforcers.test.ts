// `Kingpin's Enforcers` — {2}{B} and either arm of the OR pay for the draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KINGPINS_ENFORCERS_SCRIPT } from './kingpinsEnforcers';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ENFORCERS = "Kingpin's Enforcers";
const ARCHIVE = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; enforcers: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ENFORCERS, ARCHIVE], []],
    scripts: createRegistry([KINGPINS_ENFORCERS_SCRIPT]),
  });
  const enforcers = put(g, 'p1', ENFORCERS);
  const archive = put(g, 'p1', ARCHIVE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, enforcers, archive };
}

describe("Kingpin's Enforcers", () => {
  test('the artifact arm pays and the draw arrives', () => {
    const { g, enforcers, archive } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: enforcers,
        abilityIndex: 0,
        sacrifice: archive,
      }),
    );
    settle(g);
    expect(g.state.cards[archive]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, enforcers, archive } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: enforcers,
        abilityIndex: 0,
        sacrifice: archive,
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

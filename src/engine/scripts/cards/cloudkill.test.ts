// `Cloudkill` — X reads MY commander's mana value even in the COMMAND
// ZONE: the starter commander's MV melts the board.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CLOUDKILL_SCRIPT } from './cloudkill';
import { CLOUDKILL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Cloudkill'], ['Grizzly Bears']],
    scripts: createRegistry([CLOUDKILL_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cloudkill', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears };
}

describe('Cloudkill', () => {
  test('the commander in the COMMAND ZONE sets X and the 2/2 melts', () => {
    const { g, bears } = killed();
    // The harness's started game seats each player with a commander whose
    // mana value is at least 2 — enough to kill a 2/2 through the SBA.
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CLOUDKILL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CLOUDKILL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CLOUDKILL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

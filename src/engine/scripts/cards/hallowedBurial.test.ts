// `Hallowed Burial` — everything goes UNDER its owner's library; not
// destruction, so the indestructible Myr goes too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HALLOWED_BURIAL_SCRIPT } from './hallowedBurial';
import { HALLOWED_BURIAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function buried(): { g: Game; bears: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hallowed Burial'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([HALLOWED_BURIAL_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hallowed Burial', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, myr };
}

describe('Hallowed Burial', () => {
  test('the Bears AND the indestructible Myr go to the library BOTTOM', () => {
    const { g, bears, myr } = buried();
    const lib = g.state.zones.library['p2'] ?? [];
    expect(g.state.cards[bears]?.zone.kind).toBe('library');
    expect(g.state.cards[myr]?.zone.kind).toBe('library');
    expect(lib.slice(0, 2)).toEqual(expect.arrayContaining([bears, myr]));
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HALLOWED_BURIAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HALLOWED_BURIAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HALLOWED_BURIAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = buried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

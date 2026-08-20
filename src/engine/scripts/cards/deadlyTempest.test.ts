// `Deadly Tempest` — the wipe, then each player pays for exactly what THEY
// lost: the indestructible survivor costs its controller nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEADLY_TEMPEST_SCRIPT } from './deadlyTempest';
import { DEADLY_TEMPEST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; bears: InstanceId; maw: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Deadly Tempest', 'Grizzly Bears'], ['Colossal Dreadmaw', 'Darksteel Myr']],
    scripts: createRegistry([DEADLY_TEMPEST_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Deadly Tempest', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw, myr };
}

describe('Deadly Tempest', () => {
  test('both destroyable creatures die; each player loses exactly their own count', () => {
    const { g, bears, maw, myr } = swept();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(39);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEADLY_TEMPEST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEADLY_TEMPEST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEADLY_TEMPEST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

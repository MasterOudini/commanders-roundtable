// `Fire Tempest` — 6 to everything: both creatures die, both players
// take 6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FIRE_TEMPEST_SCRIPT } from './fireTempest';
import { FIRE_TEMPEST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tempested(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fire Tempest'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FIRE_TEMPEST_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fire Tempest', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Fire Tempest', () => {
  test('6 to everything: both creatures die, both players take 6', () => {
    const { g, bears, maw } = tempested();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(34);
    expect(g.state.players['p2']?.life).toBe(34);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FIRE_TEMPEST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FIRE_TEMPEST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FIRE_TEMPEST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = tempested();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

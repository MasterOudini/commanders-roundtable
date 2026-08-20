// `Jokulhaups` — artifacts, creatures, AND lands die; the enchantment
// and the indestructible Myr stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JOKULHAUPS_SCRIPT } from './jokulhaups';
import { JOKULHAUPS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function erupted(): {
  g: Game;
  bears: InstanceId;
  ring: InstanceId;
  swamp: InstanceId;
  flame: InstanceId;
  myr: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ['Jokulhaups', 'Captive Flame'],
      ['Grizzly Bears', 'Sol Ring', 'Swamp', 'Darksteel Myr'],
    ],
    scripts: createRegistry([JOKULHAUPS_SCRIPT]),
  });
  const flame = put(g, 'p1', 'Captive Flame');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  const swamp = put(g, 'p2', 'Swamp');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Jokulhaups', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, ring, swamp, flame, myr };
}

describe('Jokulhaups', () => {
  test('creature, artifact, and land die; the enchantment and the Myr stand', () => {
    const { g, bears, ring, swamp, flame, myr } = erupted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JOKULHAUPS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JOKULHAUPS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JOKULHAUPS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = erupted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

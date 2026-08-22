// `Taste of Blood` — the player-or-planeswalker compound plus the gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TASTE_OF_BLOOD_SCRIPT } from './tasteOfBlood';
import { TASTE_OF_BLOOD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TASTE = 'Taste of Blood';
const WALKER = 'Grist, the Hunger Tide';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tasted(at: 'player' | 'walker'): { g: Game; walker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TASTE], [WALKER]],
    scripts: createRegistry([TASTE_OF_BLOOD_SCRIPT]),
  });
  const walker = put(g, 'p2', WALKER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', TASTE, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [at === 'player' ? { kind: 'player', id: 'p2' } : { kind: 'card', id: walker }],
    }),
  );
  settle(g);
  return { g, walker };
}

describe('Taste of Blood', () => {
  test('a PLAYER takes 1 and I gain 1', () => {
    const { g } = tasted('player');
    expect(g.state.players.p2?.life).toBe(39);
    expect(g.state.players.p1?.life).toBe(41);
  });

  // ⚠️ MEASURED, not assumed: damage to a planeswalker is MARKED on the
  // permanent and does NOT remove loyalty counters — `applyDamage` writes
  // `damage`, and SBA 4 only bins a walker whose loyalty is already ≤ 0
  // (CR 306.8's damage-removes-loyalty rule is unbuilt). The player behind
  // it takes nothing either way, which is what this arm is really proving.
  test('a PLANESWALKER is the other arm — the damage is marked, the player is untouched', () => {
    const { g, walker } = tasted('walker');
    expect(g.state.cards[walker]?.damage).toBe(1);
    expect(g.state.cards[walker]?.counters['loyalty']).toBe(3);
    expect(g.state.players.p2?.life).toBe(40);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TASTE_OF_BLOOD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TASTE_OF_BLOOD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TASTE_OF_BLOOD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = tasted('player');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

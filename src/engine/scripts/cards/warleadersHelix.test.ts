// `Warleader's Helix` — 4 damage and a flat 4 gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WARLEADERS_HELIX_SCRIPT } from './warleadersHelix';
import { WARLEADER_S_HELIX } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Warleader's Helix";
const VICTIM = 'Grave Titan'; // 6/6 — survives, so the gain is separable

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(aimAtPlayer: boolean): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [VICTIM]],
    scripts: createRegistry([WARLEADERS_HELIX_SCRIPT]),
  });
  const victim = put(g, 'p2', VICTIM);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 8 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [aimAtPlayer ? { kind: 'player', id: 'p2' } : { kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe("Warleader's Helix", () => {
  test('4 onto the creature and 4 onto me', () => {
    const { g, victim } = cast(false);
    expect(g.state.cards[victim]?.damage).toBe(4);
    expect(g.state.players.p1?.life).toBe(44);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('the same 4 reaches a PLAYER, and I still gain', () => {
    const { g } = cast(true);
    expect(g.state.players.p2?.life).toBe(36);
    expect(g.state.players.p1?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WARLEADER_S_HELIX.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WARLEADER_S_HELIX.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WARLEADER_S_HELIX.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

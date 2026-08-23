// `Volcanic Geyser` — X damage, and X=0 deals NOTHING rather than a
// zero-amount entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VOLCANIC_GEYSER_SCRIPT } from './volcanicGeyser';
import { VOLCANIC_GEYSER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Volcanic Geyser';
const VICTIM = 'Grave Titan'; // 6/6 — survives 5

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(x: number, atPlayer: boolean): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [VICTIM]],
    scripts: createRegistry([VOLCANIC_GEYSER_SCRIPT]),
  });
  const victim = put(g, 'p2', VICTIM);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 12 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [atPlayer ? { kind: 'player', id: 'p2' } : { kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe('Volcanic Geyser', () => {
  test('X=5 marks the creature with 5', () => {
    const { g, victim } = cast(5, false);
    expect(g.state.cards[victim]?.damage).toBe(5);
  });

  test('X=3 reaches a player', () => {
    const { g } = cast(3, true);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('X=0 deals nothing at all', () => {
    const { g, victim } = cast(0, false);
    expect(g.state.cards[victim]?.damage ?? 0).toBe(0);
    expect(g.log.some((e) => e.body.t === 'DamageDealt')).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VOLCANIC_GEYSER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VOLCANIC_GEYSER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VOLCANIC_GEYSER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(5, false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

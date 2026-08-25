// `Windstorm` — X to every flyer, any controller; X=0 deals nothing at all.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WINDSTORM_SCRIPT } from './windstorm';
import { WINDSTORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Windstorm';
const FLYER = 'Serra Angel'; // 4/4 flying — survives 2
const GROUNDED = 'Grave Titan'; // 6/6, no flying

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(x: number): { g: Game; flyer: InstanceId; grounded: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [FLYER, GROUNDED]],
    scripts: createRegistry([WINDSTORM_SCRIPT]),
  });
  const flyer = put(g, 'p2', FLYER);
  const grounded = put(g, 'p2', GROUNDED);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  settle(g);
  return { g, flyer, grounded };
}

describe('Windstorm', () => {
  test('X=2 marks the flyer and spares the grounded creature', () => {
    const { g, flyer, grounded } = cast(2);
    expect(g.state.cards[flyer]?.damage).toBe(2);
    expect(g.state.cards[grounded]?.damage ?? 0).toBe(0);
  });

  test('X=0 deals nothing at all', () => {
    const { g, flyer } = cast(0);
    expect(g.state.cards[flyer]?.damage ?? 0).toBe(0);
    expect(g.log.some((e) => e.body.t === 'DamageDealt')).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WINDSTORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WINDSTORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WINDSTORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

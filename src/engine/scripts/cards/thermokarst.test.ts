// `Thermokarst` — the land destroy whose gain is conditioned on SNOW, read
// before the move.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { THERMOKARST_SCRIPT } from './thermokarst';
import { THERMOKARST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Thermokarst';
const SNOW = 'Snow-Covered Forest';
const PLAIN = 'Forest';
const CITADEL = 'Darksteel Citadel'; // an indestructible LAND

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(name: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [SNOW, PLAIN, CITADEL]],
    scripts: createRegistry([THERMOKARST_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Thermokarst', () => {
  test('a SNOW land dies and pays 1 life', () => {
    const { g, victim } = cast(SNOW);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('a plain land dies and pays NOTHING', () => {
    const { g, victim } = cast(PLAIN);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('an indestructible land survives and pays nothing', () => {
    const { g, victim } = cast(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = THERMOKARST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, THERMOKARST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(THERMOKARST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(SNOW);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

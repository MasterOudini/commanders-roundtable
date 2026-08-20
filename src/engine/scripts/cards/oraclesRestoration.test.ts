// `Oracle's Restoration` — pump, draw and gain in one resolve.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ORACLES_RESTORATION_SCRIPT } from './oraclesRestoration';
import { ORACLE_S_RESTORATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function restored(): { g: Game; bears: InstanceId; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [["Oracle's Restoration", 'Grizzly Bears'], []],
    scripts: createRegistry([ORACLES_RESTORATION_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Oracle's Restoration", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, bears, mid };
}

describe("Oracle's Restoration", () => {
  test('the Bears reads 3/3, a card arrives, a life arrives', () => {
    const { g, bears, mid } = restored();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ORACLE_S_RESTORATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ORACLE_S_RESTORATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ORACLE_S_RESTORATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = restored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

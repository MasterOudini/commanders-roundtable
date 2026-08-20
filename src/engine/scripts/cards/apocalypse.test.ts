// `Apocalypse` — EXILE all permanents (indestructible goes too — exile is
// not destruction), then the caster's whole hand is a choiceless discard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { APOCALYPSE_SCRIPT } from './apocalypse';
import { APOCALYPSE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ended(): { g: Game; citadel: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Apocalypse', 'Darksteel Citadel'], ['Grizzly Bears']],
    scripts: createRegistry([APOCALYPSE_SCRIPT]),
  });
  const citadel = put(g, 'p1', 'Darksteel Citadel');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Apocalypse', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, citadel, bears };
}

describe('Apocalypse', () => {
  test('EVERY permanent is exiled — the indestructible one included — and my hand is gone', () => {
    const { g, citadel, bears } = ended();
    expect(g.state.cards[citadel]?.zone.kind).toBe('exile');
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.zones.battlefield).toHaveLength(0);
    expect(g.state.zones.hand['p1'] ?? []).toHaveLength(0);
  });

  test("the OPPONENT's hand is untouched", () => {
    const { g } = ended();
    expect((g.state.zones.hand['p2'] ?? []).length).toBeGreaterThan(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = APOCALYPSE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, APOCALYPSE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(APOCALYPSE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

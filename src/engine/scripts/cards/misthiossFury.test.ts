// `Misthios's Fury` — 3 at the creature always; the 2 at its controller
// only behind an Equipment.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MISTHIOSS_FURY_SCRIPT } from './misthiossFury';
import { MISTHIOS_S_FURY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function furied(withEquipment: boolean): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Misthios's Fury", 'Swiftfoot Boots'], ['Grizzly Bears']],
    scripts: createRegistry([MISTHIOSS_FURY_SCRIPT]),
  });
  if (withEquipment) put(g, 'p1', 'Swiftfoot Boots');
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Misthios's Fury", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe("Misthios's Fury", () => {
  test('with an Equipment: the Bears dies and its controller takes 2', () => {
    const { g, victim } = furied(true);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('without one: the Bears dies and the controller is untouched', () => {
    const { g, victim } = furied(false);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MISTHIOS_S_FURY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MISTHIOS_S_FURY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MISTHIOS_S_FURY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = furied(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

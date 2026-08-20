// `Misfortune's Gain` — the creature dies and its OWNER gains 4; an
// indestructible miss still pays the owner.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MISFORTUNES_GAIN_SCRIPT } from './misfortunesGain';
import { MISFORTUNE_S_GAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gained(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Misfortune's Gain"], [victimName]],
    scripts: createRegistry([MISFORTUNES_GAIN_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Misfortune's Gain", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
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

describe("Misfortune's Gain", () => {
  test('the Bears dies and its owner gains 4', () => {
    const { g, victim } = gained('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('Darksteel Myr survives and its owner STILL gains', () => {
    const { g, victim } = gained('Darksteel Myr');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MISFORTUNE_S_GAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MISFORTUNE_S_GAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MISFORTUNE_S_GAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gained('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

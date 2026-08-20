// `Glissa's Scorn` — the destroy and the life loss are separate facts:
// an indestructible artifact LAND survives and its controller still pays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GLISSAS_SCORN_SCRIPT } from './glissasScorn';
import { GLISSA_S_SCORN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scorned(name: string): { g: Game; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Glissa's Scorn", "Glissa's Scorn"], ['Sol Ring', 'Darksteel Citadel']],
    scripts: createRegistry([GLISSAS_SCORN_SCRIPT]),
  });
  const target = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Glissa's Scorn", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target };
}

describe("Glissa's Scorn", () => {
  test('the Sol Ring dies and its controller loses 1', () => {
    const { g, target } = scorned('Sol Ring');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the indestructible artifact land survives — and its controller STILL pays', () => {
    const { g, target } = scorned('Darksteel Citadel');
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GLISSA_S_SCORN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GLISSA_S_SCORN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GLISSA_S_SCORN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = scorned('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

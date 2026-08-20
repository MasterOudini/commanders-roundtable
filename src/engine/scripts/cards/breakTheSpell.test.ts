// `Break the Spell` — the conditional draw: MY enchantment destroyed draws;
// THEIRS (nontoken) does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BREAK_THE_SPELL_SCRIPT } from './breakTheSpell';
import { BREAK_THE_SPELL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function broken(mineTargeted: boolean): { g: Game; target: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Break the Spell', 'Captive Flame'], ['Pacifism', 'Grizzly Bears']],
    scripts: createRegistry([BREAK_THE_SPELL_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Captive Flame');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  // Their enchantment arrives by a REAL cast (an unattached Aura dies to the
  // sweep — D198).
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const aura = put(g, 'p2', 'Pacifism', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const target = mineTargeted ? mine : aura;
  const spell = put(g, 'p1', 'Break the Spell', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target, before };
}

describe('Break the Spell', () => {
  test('MY destroyed enchantment draws a card', () => {
    const { g, target, before } = broken(true);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test("THEIR nontoken enchantment destroyed draws nothing", () => {
    const { g, target, before } = broken(false);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BREAK_THE_SPELL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BREAK_THE_SPELL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BREAK_THE_SPELL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = broken(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

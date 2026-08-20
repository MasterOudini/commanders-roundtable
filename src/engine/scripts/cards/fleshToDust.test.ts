// `Flesh to Dust` — the creature dies; Darksteel Myr shrugs it off.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLESH_TO_DUST_SCRIPT } from './fleshToDust';
import { FLESH_TO_DUST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dusted(name: 'Grizzly Bears' | 'Darksteel Myr'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flesh to Dust'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([FLESH_TO_DUST_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flesh to Dust', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Flesh to Dust', () => {
  test('the creature dies; the indestructible Myr survives', () => {
    const a = dusted('Grizzly Bears');
    expect(a.g.state.cards[a.victim]?.zone.kind).toBe('graveyard');
    const b = dusted('Darksteel Myr');
    expect(b.g.state.cards[b.victim]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLESH_TO_DUST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLESH_TO_DUST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLESH_TO_DUST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dusted('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

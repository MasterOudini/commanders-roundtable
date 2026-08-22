// `Tempest of Light` — ALL enchantments, not just Auras: a CAST Pacifism
// and a global enchantment both die, and the artifact beside them stands.
//
// ⚠️ The Aura is CAST, never `put()` — an unattached Aura is binned by the
// aura-falls SBA before anything can attach it (D218).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TEMPEST_OF_LIGHT_SCRIPT } from './tempestOfLight';
import { TEMPEST_OF_LIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TEMPEST = 'Tempest of Light';
const AURA = 'Pacifism';
const MANTRA = "Ajani's Mantra";
const RING = 'Sol Ring';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; aura: InstanceId; mantra: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TEMPEST, AURA, MANTRA, RING, BEARS], []],
    scripts: createRegistry([TEMPEST_OF_LIGHT_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const mantra = put(g, 'p1', MANTRA);
  const ring = put(g, 'p1', RING);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    40_000,
  );
  const aura = put(g, 'p1', AURA, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  const spell = put(g, 'p1', TEMPEST, 'hand');
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, aura, mantra, ring };
}

describe('Tempest of Light', () => {
  test('the Aura AND the global enchantment die; the artifact stands', () => {
    const { g, aura, mantra, ring } = swept();
    expect(g.state.cards[aura]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mantra]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TEMPEST_OF_LIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TEMPEST_OF_LIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TEMPEST_OF_LIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Tranquil Domain` — the negated-subtype wipe, proven from both sides on
// one board: the Aura walks away and the global enchantment does not.
//
// ⚠️ The Aura is CAST, never `put()`: the aura-falls SBA bins an unattached
// Aura before any Tier-3 attach can land (D218), so a put() Pacifism is in
// the graveyard before the sweep ever runs and would pass this test for the
// wrong reason.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRANQUIL_DOMAIN_SCRIPT } from './tranquilDomain';
import { TRANQUIL_DOMAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tranquil Domain';
const AURA = 'Pacifism';
const GLOBAL = "Ajani's Welcome";
const HOST = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; aura: InstanceId; global: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, AURA, GLOBAL, HOST], []],
    scripts: createRegistry([TRANQUIL_DOMAIN_SCRIPT]),
  });
  const host = put(g, 'p1', HOST);
  const global = put(g, 'p1', GLOBAL);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);

  // The Aura is CAST onto the Bears so it is genuinely attached.
  const aura = put(g, 'p1', AURA, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: host }] }));
  settle(g);
  expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');

  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, aura, global };
}

describe('Tranquil Domain', () => {
  test('the global enchantment dies and the AURA survives', () => {
    const { g, aura, global } = swept();
    expect(g.state.cards[global]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRANQUIL_DOMAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRANQUIL_DOMAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRANQUIL_DOMAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

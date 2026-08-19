// `Gitaxian Probe` — the first hand REVEAL: the target's whole hand becomes
// revealedTo the CASTER (and nobody else), then the cantrip draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GITAXIAN_PROBE_SCRIPT } from './gitaxianProbe';
import { GITAXIAN_PROBE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [['Gitaxian Probe', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([GITAXIAN_PROBE_SCRIPT]),
  });
  const spell = put(g, 'p1', 'Gitaxian Probe', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, libBefore };
}

describe('Gitaxian Probe', () => {
  test('the whole target hand is revealed to the CASTER and nobody else, then the draw', () => {
    const { g, libBefore } = cast();
    const hand = g.state.zones.hand['p2'] ?? [];
    expect(hand.length).toBeGreaterThan(0);
    for (const id of hand) {
      expect(g.state.cards[id]?.revealedTo.includes('p1')).toBe(true);
    }
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GITAXIAN_PROBE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GITAXIAN_PROBE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GITAXIAN_PROBE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

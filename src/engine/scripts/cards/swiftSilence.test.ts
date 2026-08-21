// `Swift Silence` — the FIRST mass counter. Two real held casts die to one
// resolution and the caster draws two, and Swift Silence itself — still on
// the stack while it resolves — is the "other" it excludes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SWIFT_SILENCE_SCRIPT } from './swiftSilence';
import { SWIFT_SILENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

// ⚠️ The second held spell is an INSTANT on purpose: two sorcery-speed
// creatures cannot stack, because the second needs an EMPTY stack. Stacking
// two spells at all means the one on top is cast at instant speed.
const SILENCE = 'Swift Silence';
const BEARS = 'Grizzly Bears';
const RITUAL = 'Dark Ritual';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hand(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

/** p2 holds `held` spells on the stack; p1 answers with Swift Silence. */
function silenced(held: 1 | 2): { g: Game; bears: InstanceId; ritual: InstanceId; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[SILENCE], [BEARS, RITUAL]],
    scripts: createRegistry([SWIFT_SILENCE_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS, 'hand');
  const ritual = put(g, 'p2', RITUAL, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 4 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    40_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  if (held === 2) {
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p2', 20_000);
    must(g.submit({ t: 'CastSpell', player: 'p2', card: ritual }));
  }
  advanceUntil(
    g,
    (s) => s.stack.length === held && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
  const spell = put(g, 'p1', SILENCE, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const before = hand(g);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, ritual, drew: hand(g) - before + 1 };
}

describe('Swift Silence', () => {
  test('TWO held spells die and the caster draws two', () => {
    const { g, bears, ritual, drew } = silenced(2);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ritual]?.zone.kind).toBe('graveyard');
    expect(drew).toBe(2);
  });

  test('ONE held spell dies and the draw is one — Swift Silence never counters itself', () => {
    const { g, bears, drew } = silenced(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(drew).toBe(1);
    expect(g.state.stack).toHaveLength(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SWIFT_SILENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SWIFT_SILENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SWIFT_SILENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = silenced(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

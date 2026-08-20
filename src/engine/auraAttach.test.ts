// CR 303.4g (D198): an Aura SPELL enters attached to what it targeted.
// Before this, every cast Aura resolved unattached and SBA 704.5m binned it
// on the very next sweep — "Ana casts Pacifism. Pacifism resolves. Pacifism
// dies." — the cast path charging mana for a dead enchantment, live since
// the sweep learned that an unattached Aura is illegal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function castAura(): { g: Game; aura: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Pacifism', 'Grizzly Bears'], []] });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const aura = put(g, 'p1', 'Pacifism', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, aura, bears };
}

describe('an Aura spell attaches on resolution (CR 303.4g)', () => {
  test('the cast Aura SURVIVES, attached to its target, both sides linked', () => {
    const { g, aura, bears } = castAura();
    expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[aura]?.attachedTo).toBe(bears);
    expect(g.state.cards[bears]?.attachments).toContain(aura);
  });

  test('the host dying still takes the Aura down — the sweep is untouched', () => {
    const { g, aura, bears } = castAura();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[aura]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = castAura();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

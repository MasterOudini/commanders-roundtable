// `Echoing Decay` — both same-name Bears die through the SBA; the
// Dreadmaw shrugs off the -2/-2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ECHOING_DECAY_SCRIPT } from './echoingDecay';
import { ECHOING_DECAY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function decayed(): { g: Game; a: InstanceId; b: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Echoing Decay'],
      ['Grizzly Bears', 'Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([ECHOING_DECAY_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  expect(b).not.toBe(a);
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Echoing Decay', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, b, maw };
}

describe('Echoing Decay', () => {
  test('both same-name Bears die; the Dreadmaw stands', () => {
    const { g, a, b, maw } = decayed();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ECHOING_DECAY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ECHOING_DECAY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ECHOING_DECAY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = decayed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

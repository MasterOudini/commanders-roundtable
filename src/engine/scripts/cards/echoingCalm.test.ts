// `Echoing Calm` — both same-name enchantments die across BOTH boards; the
// differently named one stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ECHOING_CALM_SCRIPT } from './echoingCalm';
import { ECHOING_CALM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function calmed(): { g: Game; a: InstanceId; b: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Echoing Calm', 'Captive Flame'],
      ['Captive Flame', 'Dauthi Embrace'],
    ],
    scripts: createRegistry([ECHOING_CALM_SCRIPT]),
  });
  const a = put(g, 'p2', 'Captive Flame');
  const b = put(g, 'p1', 'Captive Flame');
  const other = put(g, 'p2', 'Dauthi Embrace');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Echoing Calm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, b, other };
}

describe('Echoing Calm', () => {
  test('both same-name enchantments die across both boards; the other stays', () => {
    const { g, a, b, other } = calmed();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[other]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ECHOING_CALM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ECHOING_CALM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ECHOING_CALM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = calmed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

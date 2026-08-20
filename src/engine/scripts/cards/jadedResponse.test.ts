// `Jaded Response` — the counter fires only when the spell shares a
// color with a creature I control; both branches from real casts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JADED_RESPONSE_SCRIPT } from './jadedResponse';
import { JADED_RESPONSE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function responded(shares: boolean): { g: Game; spell: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Jaded Response', 'Elvish Herder', 'Baleful Strix'], ['Grizzly Bears']],
    scripts: createRegistry([JADED_RESPONSE_SCRIPT]),
  });
  // The Bears is GREEN: my Herder shares it; my Strix (blue-black) does not.
  put(g, 'p1', shares ? 'Elvish Herder' : 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === spell)?.id as string;
  const counter = put(g, 'p1', 'Jaded Response', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: counter }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, spell };
}

describe('Jaded Response', () => {
  test('a shared color counters the Bears', () => {
    const { g, spell } = responded(true);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('no shared color: the Bears resolves — the condition is real', () => {
    const { g, spell } = responded(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JADED_RESPONSE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JADED_RESPONSE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JADED_RESPONSE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = responded(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

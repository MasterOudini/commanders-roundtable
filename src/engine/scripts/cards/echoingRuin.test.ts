// `Echoing Ruin` — both same-name Sol Rings die across both boards; the
// other artifact stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ECHOING_RUIN_SCRIPT } from './echoingRuin';
import { ECHOING_RUIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ruined(): { g: Game; a: InstanceId; b: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Echoing Ruin', 'Sol Ring'],
      ['Sol Ring', 'Lightning Greaves'],
    ],
    scripts: createRegistry([ECHOING_RUIN_SCRIPT]),
  });
  const a = put(g, 'p2', 'Sol Ring');
  const b = put(g, 'p1', 'Sol Ring');
  const other = put(g, 'p2', 'Lightning Greaves');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Echoing Ruin', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, b, other };
}

describe('Echoing Ruin', () => {
  test('both same-name artifacts die across both boards; the other stays', () => {
    const { g, a, b, other } = ruined();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[other]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ECHOING_RUIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ECHOING_RUIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ECHOING_RUIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ruined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

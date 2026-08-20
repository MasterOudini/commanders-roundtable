// `Mobilize` — my tapped creatures straighten; the opponent's stays turned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MOBILIZE_SCRIPT } from './mobilize';
import { MOBILIZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mobilized(): { g: Game; mine: InstanceId; other: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mobilize', 'Grizzly Bears', 'Aysen Bureaucrats'], ['Grizzly Bears']],
    scripts: createRegistry([MOBILIZE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const other = put(g, 'p1', 'Aysen Bureaucrats');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mine, other], tapped: true }));
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [theirs], tapped: true }));
  const spell = put(g, 'p1', 'Mobilize', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, other, theirs };
}

describe('Mobilize', () => {
  test('my two straighten; the opponent stays turned', () => {
    const { g, mine, other, theirs } = mobilized();
    expect(g.state.cards[mine]?.tapped).toBe(false);
    expect(g.state.cards[other]?.tapped).toBe(false);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MOBILIZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MOBILIZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MOBILIZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mobilized();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

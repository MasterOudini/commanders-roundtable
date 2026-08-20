// `Fated Retribution` — the wipe fells the creature, and on MY turn the
// scry 2 asks after it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FATED_RETRIBUTION_SCRIPT } from './fatedRetribution';
import { FATED_RETRIBUTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function retributed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fated Retribution'], ['Grizzly Bears']],
    scripts: createRegistry([FATED_RETRIBUTION_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fated Retribution', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  return { g, bears };
}

describe('Fated Retribution', () => {
  test('the wipe fells the creature; on MY turn the scry 2 asks', () => {
    const { g, bears } = retributed();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FATED_RETRIBUTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FATED_RETRIBUTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FATED_RETRIBUTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = retributed();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

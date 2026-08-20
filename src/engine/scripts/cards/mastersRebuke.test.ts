// `Master's Rebuke` — Bite Down's text on its own id: the Bears bites the
// Bureaucrats dead.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MASTERS_REBUKE_SCRIPT } from './mastersRebuke';
import { MASTER_S_REBUKE, BITE_DOWN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rebuked(): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Master's Rebuke", 'Grizzly Bears'], ['Aysen Bureaucrats']],
    scripts: createRegistry([MASTERS_REBUKE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const victim = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Master's Rebuke", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: bears },
        { kind: 'card', id: victim },
      ],
    }),
  );
  settle(g);
  return { g, victim };
}

describe("Master's Rebuke", () => {
  test('carries the family text verbatim', () => {
    expect(MASTER_S_REBUKE.faces[0]?.oracleText).toBe(BITE_DOWN.faces[0]?.oracleText);
  });

  test('the Bears bites the Bureaucrats dead, one way', () => {
    const { g, victim } = rebuked();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MASTER_S_REBUKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MASTER_S_REBUKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MASTER_S_REBUKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rebuked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

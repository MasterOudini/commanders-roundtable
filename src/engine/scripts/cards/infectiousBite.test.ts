// `Infectious Bite` — the bite lands and each opponent takes a poison
// counter; the caster stays clean.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INFECTIOUS_BITE_SCRIPT } from './infectiousBite';
import { INFECTIOUS_BITE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bitten(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Infectious Bite', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([INFECTIOUS_BITE_SCRIPT]),
  });
  const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Infectious Bite', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: dreadmaw },
        { kind: 'card', id: bears },
      ],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Infectious Bite', () => {
  test('the 6/6 eats the 2/2 and the opponent takes exactly one poison counter', () => {
    const { g, bears } = bitten();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.poison).toBe(1);
    expect(g.state.players['p1']?.poison).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INFECTIOUS_BITE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INFECTIOUS_BITE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INFECTIOUS_BITE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bitten();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

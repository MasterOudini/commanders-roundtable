// `Flay Essence` — the exiled creature pays its counters in life: two
// +1/+1 counters set by hand make the gain exactly 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLAY_ESSENCE_SCRIPT } from './flayEssence';
import { FLAY_ESSENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flayed(counters: number): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flay Essence'], ['Grizzly Bears']],
    scripts: createRegistry([FLAY_ESSENCE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  if (counters > 0) {
    must(
      g.submit({
        t: 'ManualSetCounter',
        player: 'p2',
        card: bears,
        kind: '+1/+1',
        delta: counters,
      }),
    );
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flay Essence', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Flay Essence', () => {
  test('two counters pay 2; the creature is exiled', () => {
    const { g, bears } = flayed(2);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('no counters pay nothing', () => {
    const { g, bears } = flayed(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLAY_ESSENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLAY_ESSENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLAY_ESSENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flayed(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

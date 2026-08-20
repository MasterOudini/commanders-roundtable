// `Into the Core` — both artifact picks are exiled, indestructibility
// notwithstanding (exile is not destruction).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INTO_THE_CORE_SCRIPT } from './intoTheCore';
import { INTO_THE_CORE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cored(): { g: Game; ring: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Into the Core'], ['Sol Ring', 'Darksteel Myr']],
    scripts: createRegistry([INTO_THE_CORE_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Into the Core', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: ring },
        { kind: 'card', id: myr },
      ],
    }),
  );
  settle(g);
  return { g, ring, myr };
}

describe('Into the Core', () => {
  test('both picks — the indestructible Myr included — are exiled', () => {
    const { g, ring, myr } = cored();
    expect(g.state.cards[ring]?.zone.kind).toBe('exile');
    expect(g.state.cards[myr]?.zone.kind).toBe('exile');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INTO_THE_CORE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INTO_THE_CORE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INTO_THE_CORE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

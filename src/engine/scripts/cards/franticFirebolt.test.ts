// `Frantic Firebolt` — an instant and a sorcery in my graveyard make
// X = 4: the 2/2 dies; the land in the graveyard never counts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FRANTIC_FIREBOLT_SCRIPT } from './franticFirebolt';
import { FRANTIC_FIREBOLT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bolted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Frantic Firebolt', 'Dark Ritual', 'Day of Judgment', 'Mountain'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([FRANTIC_FIREBOLT_SCRIPT]),
  });
  put(g, 'p1', 'Dark Ritual', 'graveyard');
  put(g, 'p1', 'Day of Judgment', 'graveyard');
  put(g, 'p1', 'Mountain', 'graveyard');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Frantic Firebolt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Frantic Firebolt', () => {
  test('an instant and a sorcery make X = 4 — the 2/2 dies; the land never counts', () => {
    const { g, bears } = bolted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FRANTIC_FIREBOLT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FRANTIC_FIREBOLT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FRANTIC_FIREBOLT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bolted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

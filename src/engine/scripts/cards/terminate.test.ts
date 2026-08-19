// `Terminate` — unconditional destroy; the regen clause is vacuous under
// damnation.node.test.ts's source-scan tripwire.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TERMINATE_SCRIPT } from './terminate';
import { TERMINATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(victim: string): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Terminate'], [victim]],
    scripts: createRegistry([TERMINATE_SCRIPT]),
  });
  const theirs = put(g, 'p2', victim);
  settle(g);
  const spell = put(g, 'p1', 'Terminate', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Terminate', () => {
  test('destroys the creature; an indestructible one survives, the spell still resolves', () => {
    const a = board('Grizzly Bears');
    expect(a.g.state.cards[a.theirs]?.zone.kind).toBe('graveyard');
    const b = board('Darksteel Myr');
    expect(b.g.state.cards[b.theirs]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TERMINATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TERMINATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TERMINATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

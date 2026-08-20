// `Agonizing Syphon` — 3 at the target, 3 back to the caster.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AGONIZING_SYPHON_SCRIPT } from './agonizingSyphon';
import { AGONIZING_SYPHON } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Agonizing Syphon'], ['Grizzly Bears']],
    scripts: createRegistry([AGONIZING_SYPHON_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Agonizing Syphon', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Agonizing Syphon', () => {
  test('the Bears die of 3 and the caster gains 3', () => {
    const { g, theirs } = board();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AGONIZING_SYPHON.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AGONIZING_SYPHON.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AGONIZING_SYPHON.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

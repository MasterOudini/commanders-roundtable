// `Ire of Kaminari` — the damage counts Arcane cards in my graveyard;
// the non-Arcane instant counts nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { IRE_OF_KAMINARI_SCRIPT } from './ireOfKaminari';
import { IRE_OF_KAMINARI } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function angered(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ire of Kaminari', 'Inner Calm, Outer Strength', 'Heat Ray'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([IRE_OF_KAMINARI_SCRIPT]),
  });
  put(g, 'p1', 'Inner Calm, Outer Strength', 'graveyard');
  put(g, 'p1', 'Heat Ray', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Ire of Kaminari', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Ire of Kaminari', () => {
  test('one Arcane card in the graveyard deals exactly 1; the plain instant counts nothing', () => {
    const { g } = angered();
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = IRE_OF_KAMINARI.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, IRE_OF_KAMINARI.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(IRE_OF_KAMINARI.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = angered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

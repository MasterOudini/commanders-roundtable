// `Consign to the Pit` — the kill plus the unconditional 2 to the
// controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONSIGN_TO_THE_PIT_SCRIPT } from './consignToThePit';
import { CONSIGN_TO_THE_PIT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function consigned(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Consign to the Pit'], ['Grizzly Bears']],
    scripts: createRegistry([CONSIGN_TO_THE_PIT_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Consign to the Pit', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Consign to the Pit', () => {
  test('the creature dies and its controller takes 2', () => {
    const { g, bears } = consigned();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONSIGN_TO_THE_PIT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONSIGN_TO_THE_PIT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONSIGN_TO_THE_PIT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = consigned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

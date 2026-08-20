// `Breathe Your Last` — the kill pays 1 per COLOR of the victim: a green
// 2/2 pays one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BREATHE_YOUR_LAST_SCRIPT } from './breatheYourLast';
import { BREATHE_YOUR_LAST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Breathe Your Last'], ['Grizzly Bears']],
    scripts: createRegistry([BREATHE_YOUR_LAST_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Breathe Your Last', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Breathe Your Last', () => {
  test('the green 2/2 dies and pays ONE life', () => {
    const { g, bears } = killed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BREATHE_YOUR_LAST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BREATHE_YOUR_LAST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BREATHE_YOUR_LAST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

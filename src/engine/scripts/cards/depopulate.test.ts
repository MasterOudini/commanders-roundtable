// `Depopulate` — the multicolored Strix earns its controller a draw, the
// mono-colored side draws nothing, and then everything dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEPOPULATE_SCRIPT } from './depopulate';
import { DEPOPULATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function culled(): { g: Game; mine: number; theirs: number; bears: InstanceId; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Depopulate', 'Grizzly Bears'], ['Baleful Strix']],
    scripts: createRegistry([DEPOPULATE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Depopulate', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears, strix };
}

describe('Depopulate', () => {
  test('the Strix owner draws one, the Bears owner none, and both creatures die', () => {
    const { g, mine, theirs, bears, strix } = culled();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 1);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEPOPULATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEPOPULATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEPOPULATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = culled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

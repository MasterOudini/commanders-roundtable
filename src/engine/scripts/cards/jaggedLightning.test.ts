// `Jagged Lightning` — 3 lands on EACH pick: the 2/2 dies and the 6/6
// carries 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JAGGED_LIGHTNING_SCRIPT } from './jaggedLightning';
import { JAGGED_LIGHTNING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function jagged(): { g: Game; bears: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Jagged Lightning'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([JAGGED_LIGHTNING_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Jagged Lightning', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'card', id: big },
      ],
    }),
  );
  settle(g);
  return { g, bears, big };
}

describe('Jagged Lightning', () => {
  test('3 to each pick: the 2/2 dies, the 6/6 carries 3', () => {
    const { g, bears, big } = jagged();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[big]?.damage).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JAGGED_LIGHTNING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JAGGED_LIGHTNING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JAGGED_LIGHTNING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = jagged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

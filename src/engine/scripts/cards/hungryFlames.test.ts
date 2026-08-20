// `Hungry Flames` — two arrows: 3 kills the 2/2, 2 hits the player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HUNGRY_FLAMES_SCRIPT } from './hungryFlames';
import { HUNGRY_FLAMES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hungry Flames'], ['Grizzly Bears']],
    scripts: createRegistry([HUNGRY_FLAMES_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hungry Flames', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Hungry Flames', () => {
  test('3 kills the 2/2 and 2 reaches the player in one resolve', () => {
    const { g, bears } = fed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HUNGRY_FLAMES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HUNGRY_FLAMES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HUNGRY_FLAMES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

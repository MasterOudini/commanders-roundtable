// `Wretched Banquet` — only the LEAST-power creature dies; a tie counts; the
// bigger one survives its own targeting.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WRETCHED_BANQUET_SCRIPT } from './wretchedBanquet';
import { WRETCHED_BANQUET } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wretched Banquet';
const SMALL = 'Llanowar Elves'; // 1/1
const BIG = 'Grizzly Bears'; // 2/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(pick: 'small' | 'big', board: string[]): { g: Game; small: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [SMALL, BIG, SMALL]],
    scripts: createRegistry([WRETCHED_BANQUET_SCRIPT]),
  });
  const ids = board.map((n) => put(g, 'p2', n));
  const small = ids[board.indexOf(SMALL)] as InstanceId;
  const big = ids[board.indexOf(BIG)] as InstanceId;
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: pick === 'small' ? small : big }],
    }),
  );
  settle(g);
  return { g, small, big };
}

describe('Wretched Banquet', () => {
  test('the SMALLEST creature dies', () => {
    const { g, small } = cast('small', [SMALL, BIG]);
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
  });

  test('a BIGGER creature survives being targeted', () => {
    const { g, big } = cast('big', [SMALL, BIG]);
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
  });

  test('a TIE for least still dies', () => {
    const { g, small } = cast('small', [SMALL, SMALL]);
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WRETCHED_BANQUET.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WRETCHED_BANQUET.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WRETCHED_BANQUET.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('small', [SMALL, BIG]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Donate` — the opponent gains control of my Sol Ring; the ring stays on
// the battlefield with a new controller and its old owner.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DONATE_SCRIPT } from './donate';
import { DONATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function donated(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Donate', 'Sol Ring'], ['Grizzly Bears']],
    scripts: createRegistry([DONATE_SCRIPT]),
  });
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Donate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'player', id: 'p2' },
        { kind: 'card', id: ring },
      ],
    }),
  );
  settle(g);
  return { g, ring };
}

describe('Donate', () => {
  test('the opponent gains control; the owner stays me', () => {
    const { g, ring } = donated();
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ring]?.controller).toBe('p2');
    expect(g.state.cards[ring]?.owner).toBe('p1');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DONATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DONATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DONATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = donated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

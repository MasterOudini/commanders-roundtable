// `Slobad, Goblin Tinkerer` — one Sol Ring pays, the other becomes
// indestructible until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SLOBAD_GOBLIN_TINKERER_SCRIPT } from './slobadGoblinTinkerer';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tinkered(): { g: Game; paid: InstanceId; saved: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Slobad, Goblin Tinkerer', 'Sol Ring', 'Sol Ring'], []],
    scripts: createRegistry([SLOBAD_GOBLIN_TINKERER_SCRIPT]),
  });
  const slobad = put(g, 'p1', 'Slobad, Goblin Tinkerer');
  const paid = put(g, 'p1', 'Sol Ring');
  const saved = put(g, 'p1', 'Sol Ring');
  if (paid === saved) throw new Error('the two Rings must be distinct');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: slobad,
      abilityIndex: 0,
      sacrifice: paid,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: saved }] }));
  settle(g);
  return { g, paid, saved };
}

describe('Slobad, Goblin Tinkerer', () => {
  test('the sacrificed Ring pays; the other gains indestructible until cleanup', () => {
    const { g, paid, saved } = tinkered();
    expect(g.state.cards[paid]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, saved).keywords.has('indestructible')).toBe(
      true,
    );
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, saved).keywords.has('indestructible')).toBe(
      false,
    );
  });

  test('replays to the same hash', () => {
    const { g } = tinkered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

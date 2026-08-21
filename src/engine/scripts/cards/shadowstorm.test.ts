// `Shadowstorm` — the creature GRANTED shadow dies, the plain one is
// exempt: the filter reads the DERIVED keyword, proven by composing the
// shipped Dauthi Embrace grant.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHADOWSTORM_SCRIPT } from './shadowstorm';
import { DAUTHI_EMBRACE_SCRIPT } from './dauthiEmbrace';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stormed(): { g: Game; shadowed: InstanceId; plain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Shadowstorm', 'Dauthi Embrace', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SHADOWSTORM_SCRIPT, DAUTHI_EMBRACE_SCRIPT]),
  });
  put(g, 'p1', 'Dauthi Embrace');
  const shadowed = put(g, 'p1', 'Grizzly Bears');
  const plain = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const embrace = (g.state.zones.battlefield ?? []).find((id) => {
    const inst = g.state.cards[id];
    return inst && g.deps.oracle.byPrinting(inst.printingId)?.name === 'Dauthi Embrace';
  }) as InstanceId;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: embrace,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: shadowed }],
    }),
  );
  settle(g);
  const spell = put(g, 'p1', 'Shadowstorm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, shadowed, plain };
}

describe('Shadowstorm', () => {
  test('the shadow-granted creature dies; the plain one stands', () => {
    const { g, shadowed, plain } = stormed();
    expect(g.state.cards[shadowed]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[plain]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = stormed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

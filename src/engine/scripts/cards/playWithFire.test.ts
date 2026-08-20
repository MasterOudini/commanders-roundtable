// `Play with Fire` — a creature target burns without the scry; a player
// target raises the ask.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLAY_WITH_FIRE_SCRIPT } from './playWithFire';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function lit(target: 'creature' | 'player'): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Play with Fire'], ['Grizzly Bears']],
    scripts: createRegistry([PLAY_WITH_FIRE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Play with Fire', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [target === 'creature' ? { kind: 'card', id: bears } : { kind: 'player', id: 'p2' }],
    }),
  );
  return { g, bears };
}

describe('Play with Fire', () => {
  test('a creature target dies and nothing asks', () => {
    const { g, bears } = lit('creature');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.priority.awaiting?.kind).not.toBe('scryChoice');
  });

  test('a player target takes 2 and the scry asks', () => {
    const { g } = lit('player');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.players['p2']?.life).toBe(38);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed);
  });

  test('replays to the same hash', () => {
    const { g } = lit('player');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

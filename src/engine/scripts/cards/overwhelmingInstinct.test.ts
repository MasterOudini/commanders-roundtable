// `Overwhelming Instinct` — three attackers draw; two draw nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OVERWHELMING_INSTINCT_SCRIPT } from './overwhelmingInstinct';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function instincted(three: boolean): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Overwhelming Instinct', 'Grizzly Bears', 'Aysen Bureaucrats', 'Aysen Bureaucrats'],
      [],
    ],
    scripts: createRegistry([OVERWHELMING_INSTINCT_SCRIPT]),
  });
  put(g, 'p1', 'Overwhelming Instinct');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const a = put(g, 'p1', 'Aysen Bureaucrats');
  const b = put(g, 'p1', 'Aysen Bureaucrats');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  const list: { card: InstanceId; defender: { kind: 'player'; id: 'p2' } }[] = [
    { card: bears, defender: { kind: 'player', id: 'p2' } },
    { card: a, defender: { kind: 'player', id: 'p2' } },
  ];
  if (three) list.push({ card: b, defender: { kind: 'player', id: 'p2' } });
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: list }));
  settle(g);
  return { g, mid };
}

describe('Overwhelming Instinct', () => {
  test('three attackers draw a card', () => {
    const { g, mid } = instincted(true);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('two attackers draw nothing', () => {
    const { g, mid } = instincted(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid);
  });

  test('replays to the same hash', () => {
    const { g } = instincted(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Elvish Scrapper` — the artifact dies with the Scrapper spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELVISH_SCRAPPER_SCRIPT } from './elvishScrapper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SCRAPPER = 'Elvish Scrapper';
const ARTIFACT = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; scrapper: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SCRAPPER], [ARTIFACT]],
    scripts: createRegistry([ELVISH_SCRAPPER_SCRIPT]),
  });
  const scrapper = put(g, 'p1', SCRAPPER);
  const theirs = put(g, 'p2', ARTIFACT);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  return { g, scrapper, theirs };
}

describe('Elvish Scrapper', () => {
  test('destroys the artifact with the Scrapper spent on the answer', () => {
    const { g, scrapper, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: scrapper, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[scrapper]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, scrapper, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: scrapper, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

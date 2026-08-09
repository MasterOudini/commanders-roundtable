// `Filigree Sages` — untaps a tapped artifact; an untapped one gets no
// event.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FILIGREE_SAGES_SCRIPT } from './filigreeSages';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SAGES = 'Filigree Sages';
const ARTIFACT = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; sages: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SAGES, ARTIFACT], []],
    scripts: createRegistry([FILIGREE_SAGES_SCRIPT]),
  });
  const sages = put(g, 'p1', SAGES);
  const archive = put(g, 'p1', ARTIFACT);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [archive], tapped: true }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, sages, archive };
}

describe('Filigree Sages', () => {
  test('untaps the tapped artifact', () => {
    const { g, sages, archive } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sages, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: archive }] }));
    settle(g);
    expect(g.state.cards[archive]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, sages, archive } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sages, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: archive }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Decimate` — four targets, four graves; with the land swapped for
// Darksteel Citadel the other three still die and the Citadel stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DECIMATE_SCRIPT } from './decimate';
import { DECIMATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function decimated(land: 'Mountain' | 'Darksteel Citadel'): {
  g: Game;
  ring: InstanceId;
  bears: InstanceId;
  flame: InstanceId;
  ground: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ['Decimate'],
      ['Sol Ring', 'Grizzly Bears', 'Captive Flame', 'Mountain', 'Darksteel Citadel'],
    ],
    scripts: createRegistry([DECIMATE_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const flame = put(g, 'p2', 'Captive Flame');
  const ground = put(g, 'p2', land);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Decimate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: ring },
        { kind: 'card', id: bears },
        { kind: 'card', id: flame },
        { kind: 'card', id: ground },
      ],
    }),
  );
  settle(g);
  return { g, ring, bears, flame, ground };
}

describe('Decimate', () => {
  test('all four targets die in one move', () => {
    const { g, ring, bears, flame, ground } = decimated('Mountain');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.zone.kind).toBe('graveyard');
  });

  test('Darksteel Citadel survives; the other three still die', () => {
    const { g, ring, bears, flame, ground } = decimated('Darksteel Citadel');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DECIMATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DECIMATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DECIMATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = decimated('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

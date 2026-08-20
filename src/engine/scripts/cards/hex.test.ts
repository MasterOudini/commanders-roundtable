// `Hex` — six targets, one submit: five Bears die and the sixth pick —
// the indestructible Myr — survives its own destruction.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HEX_SCRIPT } from './hex';
import { HEX } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hexed(): { g: Game; bears: InstanceId[]; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Hex'],
      [
        'Grizzly Bears',
        'Grizzly Bears',
        'Grizzly Bears',
        'Grizzly Bears',
        'Grizzly Bears',
        'Darksteel Myr',
      ],
    ],
    scripts: createRegistry([HEX_SCRIPT]),
  });
  const bears = [
    put(g, 'p2', 'Grizzly Bears'),
    put(g, 'p2', 'Grizzly Bears'),
    put(g, 'p2', 'Grizzly Bears'),
    put(g, 'p2', 'Grizzly Bears'),
    put(g, 'p2', 'Grizzly Bears'),
  ];
  expect(new Set(bears).size).toBe(5);
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hex', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [...bears.map((id) => ({ kind: 'card' as const, id })), { kind: 'card', id: myr }],
    }),
  );
  settle(g);
  return { g, bears, myr };
}

describe('Hex', () => {
  test('five of the six targets die; the indestructible sixth stands', () => {
    const { g, bears, myr } = hexed();
    for (const id of bears) expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HEX.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HEX.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HEX.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hexed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

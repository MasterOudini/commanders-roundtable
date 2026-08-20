// `Desynchronization` — the plain creatures bounce on BOTH sides; the
// artifact and the artifact creature are historic and stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DESYNCHRONIZATION_SCRIPT } from './desynchronization';
import { DESYNCHRONIZATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function desynced(): { g: Game; mine: InstanceId; bears: InstanceId; ring: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Desynchronization', 'Grizzly Bears'], ['Grizzly Bears', 'Sol Ring', 'Darksteel Myr']],
    scripts: createRegistry([DESYNCHRONIZATION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Desynchronization', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, bears, ring, myr };
}

describe('Desynchronization', () => {
  test('nonhistoric creatures bounce; the artifact and artifact creature stand', () => {
    const { g, mine, bears, ring, myr } = desynced();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DESYNCHRONIZATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DESYNCHRONIZATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DESYNCHRONIZATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = desynced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

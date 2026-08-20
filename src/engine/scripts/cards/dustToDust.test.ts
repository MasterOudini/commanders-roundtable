// `Dust to Dust` — both picked artifacts leave for exile, indestructible
// included (exile is not destroy).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DUST_TO_DUST_SCRIPT } from './dustToDust';
import { DUST_TO_DUST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dusted(): { g: Game; ring: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dust to Dust'], ['Sol Ring', 'Darksteel Myr']],
    scripts: createRegistry([DUST_TO_DUST_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dust to Dust', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: ring },
        { kind: 'card', id: myr },
      ],
    }),
  );
  settle(g);
  return { g, ring, myr };
}

describe('Dust to Dust', () => {
  test('both artifacts are exiled — the indestructible one included', () => {
    const { g, ring, myr } = dusted();
    expect(g.state.cards[ring]?.zone.kind).toBe('exile');
    expect(g.state.cards[myr]?.zone.kind).toBe('exile');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DUST_TO_DUST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DUST_TO_DUST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DUST_TO_DUST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dusted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

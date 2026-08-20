// `Noxious Revival` — the graveyard card lands on TOP of its owner's
// library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NOXIOUS_REVIVAL_SCRIPT } from './noxiousRevival';
import { NOXIOUS_REVIVAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function revived(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Noxious Revival'], ['Grizzly Bears']],
    scripts: createRegistry([NOXIOUS_REVIVAL_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: bears,
      to: { kind: 'graveyard', player: 'p2' },
    }),
  );
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Noxious Revival', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Noxious Revival', () => {
  test("lands on TOP of its owner's library", () => {
    const { g, bears } = revived();
    const card = g.state.cards[bears];
    expect(card?.zone.kind).toBe('library');
    expect(card?.zone.kind === 'library' && card.zone.player).toBe('p2');
    const lib = g.state.zones.library['p2'] ?? [];
    // Top of the library is the array END.
    expect(lib[lib.length - 1]).toBe(bears);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NOXIOUS_REVIVAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NOXIOUS_REVIVAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NOXIOUS_REVIVAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = revived();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

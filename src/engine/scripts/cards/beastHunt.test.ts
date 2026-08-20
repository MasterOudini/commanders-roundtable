// `Beast Hunt` — a PLANTED top three sorts exactly: creatures to hand, the
// rest to the graveyard, everything revealed to all.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BEAST_HUNT_SCRIPT } from './beastHunt';
import { BEAST_HUNT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hunted(): { g: Game; c1: InstanceId; land: InstanceId; c2: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Beast Hunt', 'Grizzly Bears', 'Mountain', 'Llanowar Elves'], ['Grizzly Bears']],
    scripts: createRegistry([BEAST_HUNT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // Plant a known top three: creature / land / creature (last planted = top).
  const c1 = put(g, 'p1', 'Grizzly Bears', 'hand');
  const land = put(g, 'p1', 'Mountain', 'hand');
  const c2 = put(g, 'p1', 'Llanowar Elves', 'hand');
  for (const id of [c1, land, c2]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
  }
  const spell = put(g, 'p1', 'Beast Hunt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, c1, land, c2 };
}

describe('Beast Hunt', () => {
  test('creatures to HAND, the land to the GRAVEYARD, all revealed', () => {
    const { g, c1, land, c2 } = hunted();
    expect(g.state.cards[c1]?.zone.kind).toBe('hand');
    expect(g.state.cards[c2]?.zone.kind).toBe('hand');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    // The reveal is ON THE LOG — the zone moves clear per-card reveal state
    // (D114's rule), and the graveyard is public anyway.
    const revealed = g.log.some((e) => {
      const b = (e as { body?: { t?: string; cards?: readonly string[] } }).body;
      return b?.t === 'CardsRevealed' && (b.cards ?? []).includes(land);
    });
    expect(revealed).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BEAST_HUNT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BEAST_HUNT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BEAST_HUNT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hunted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

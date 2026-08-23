// `Tombfire` — the flashback read, proven from BOTH sides in one graveyard,
// and pinned against the reminder-text trap that a naive text scan would fall
// into.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TOMBFIRE_SCRIPT } from './tombfire';
import { TOMBFIRE, FORBIDDEN_ALCHEMY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tombfire';
const FLASHBACK = 'Forbidden Alchemy'; // prints `Flashback {6}{B}`
const PLAIN = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(victim: 'p1' | 'p2'): { g: Game; alchemy: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, FLASHBACK, PLAIN], [FLASHBACK, PLAIN]],
    scripts: createRegistry([TOMBFIRE_SCRIPT]),
  });
  const alchemy = put(g, victim, FLASHBACK, 'graveyard');
  const bears = put(g, victim, PLAIN, 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: victim }] }));
  settle(g);
  return { g, alchemy, bears };
}

describe('Tombfire', () => {
  test("the flashback card is exiled and its neighbour is not", () => {
    const { g, alchemy, bears } = burned('p2');
    expect(g.state.cards[alchemy]?.zone.kind).toBe('exile');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('it can be aimed at MYSELF — the clause is "target player"', () => {
    const { g, alchemy, bears } = burned('p1');
    expect(g.state.cards[alchemy]?.zone.kind).toBe('exile');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the raw Scryfall keyword list is what the def reads, not the Tier-2 set', () => {
    // ⚠️ This is the finding the card is worth landing for: the ENGINE's
    // narrowed keyword union has no 'Flashback', but `OracleCard.data` keeps
    // the original CardData, so the raw list is reachable from a script.
    expect(FORBIDDEN_ALCHEMY.keywords).toContain('Flashback');
    expect(FORBIDDEN_ALCHEMY.faces[0]?.oracleText ?? '').toContain('Flashback {6}{B}');
  });

  test("a text scan would have exiled Tombfire's own card — the keyword read does not", () => {
    // Tombfire prints the WORD flashback in its own rules text. A def that
    // regexed the text would match a Tombfire sitting in the graveyard.
    const own = TOMBFIRE.faces[0]?.oracleText ?? '';
    expect(own.toLowerCase()).toContain('flashback');
    expect(TOMBFIRE.keywords).not.toContain('Flashback');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TOMBFIRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TOMBFIRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TOMBFIRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burned('p2');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Calming Verse` — theirs always dies; MINE dies only behind an untapped
// land, both branches from one board shape.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CALMING_VERSE_SCRIPT } from './calmingVerse';
import { CALMING_VERSE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function versed(untappedLand: boolean): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Calming Verse', 'Captive Flame', 'Mountain'], ['Captive Flame']],
    scripts: createRegistry([CALMING_VERSE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Captive Flame');
  const theirs = put(g, 'p2', 'Captive Flame');
  const land = put(g, 'p1', 'Mountain');
  if (!untappedLand) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [land], tapped: true }));
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Calming Verse', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Calming Verse', () => {
  test('with an UNTAPPED land, both sides lose their enchantments', () => {
    const { g, mine, theirs } = versed(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
  });

  test('with every land TAPPED, only theirs dies', () => {
    const { g, mine, theirs } = versed(false);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CALMING_VERSE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CALMING_VERSE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CALMING_VERSE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = versed(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

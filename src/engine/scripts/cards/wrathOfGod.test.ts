// `Wrath of God` — Damnation's shape on the original: both sides die in one
// event, indestructible survives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WRATH_OF_GOD_SCRIPT } from './wrathOfGod';
import { WRATH_OF_GOD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mine: InstanceId; theirs: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Wrath of God', 'Grizzly Bears'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([WRATH_OF_GOD_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  const wrath = put(g, 'p1', 'Wrath of God', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath }));
  settle(g);
  return { g, mine, theirs, myr };
}

describe('Wrath of God', () => {
  test('both sides die simultaneously; the indestructible Myr survives', () => {
    const { g, mine, theirs, myr } = board();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    const wipes = g.log.filter(
      (e) => e.body.t === 'CardsMoved' && e.body.moves.length >= 2 &&
        e.body.moves.every((m) => m.to.kind === 'graveyard'),
    );
    expect(wipes.length).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WRATH_OF_GOD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WRATH_OF_GOD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WRATH_OF_GOD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

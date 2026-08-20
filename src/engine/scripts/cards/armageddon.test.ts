// `Armageddon` — destroy all LANDS: the type wipe one row over from Wrath,
// with the indestructible land surviving and every creature untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ARMAGEDDON_SCRIPT } from './armageddon';
import { ARMAGEDDON } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; mine: InstanceId; theirs: InstanceId; citadel: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Armageddon', 'Mountain', 'Darksteel Citadel'], ['Forest', 'Grizzly Bears']],
    scripts: createRegistry([ARMAGEDDON_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Mountain');
  const citadel = put(g, 'p1', 'Darksteel Citadel');
  const theirs = put(g, 'p2', 'Forest');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Armageddon', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, citadel, bears };
}

describe('Armageddon', () => {
  test('every land dies on BOTH sides; the indestructible one and the creature stay', () => {
    const { g, mine, theirs, citadel, bears } = swept();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ARMAGEDDON.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ARMAGEDDON.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ARMAGEDDON.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

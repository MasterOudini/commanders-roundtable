// `Phyrexian Vault` — a creature goes in, a card comes out.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_VAULT_SCRIPT } from './phyrexianVault';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function vaulted(): { g: Game; vault: string; bears: string; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [['Phyrexian Vault', 'Grizzly Bears'], []],
    scripts: createRegistry([PHYREXIAN_VAULT_SCRIPT]),
  });
  const vault = put(g, 'p1', 'Phyrexian Vault');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: vault, abilityIndex: 0, sacrifice: bears }));
  settle(g);
  const drew = g.log
    .slice(logAt)
    .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
    .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
  return { g, vault, bears, drew };
}

describe('Phyrexian Vault', () => {
  test('eats the creature, stays put, and draws one', () => {
    const { g, vault, bears, drew } = vaulted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[vault]?.zone.kind).toBe('battlefield');
    expect(drew).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = vaulted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

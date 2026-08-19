// `Spearbreaker Behemoth` — the composition proof of two of the night's
// landings: a GRANTED indestructible (D194's rider from an activated def)
// survives a scripted WRATH, because the wipe asks the derived keyword set.
// The D139 floor refuses a 2-power target at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPEARBREAKER_BEHEMOTH_SCRIPT } from './spearbreakerBehemoth';
import { WRATH_OF_GOD_SCRIPT } from './wrathOfGod';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; behemoth: InstanceId; maw: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Spearbreaker Behemoth', 'Colossal Dreadmaw', 'Grizzly Bears', 'Wrath of God'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SPEARBREAKER_BEHEMOTH_SCRIPT, WRATH_OF_GOD_SCRIPT]),
  });
  const behemoth = put(g, 'p1', 'Spearbreaker Behemoth');
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  return { g, behemoth, maw, bears };
}

describe('Spearbreaker Behemoth', () => {
  test('a 2-power target is refused; the granted Dreadmaw SURVIVES the wrath', () => {
    const { g, behemoth, maw, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: behemoth, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const refused = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(refused.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
    settle(g);

    const wrath = put(g, 'p1', 'Wrath of God', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath }));
    settle(g);
    // The granted Dreadmaw stands; the ungranted Bears die. The Behemoth's
    // own PRINTED indestructible keeps it standing too — both sources of the
    // same keyword through one derived set.
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[behemoth]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, behemoth, maw } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: behemoth, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

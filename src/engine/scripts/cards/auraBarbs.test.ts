// `Aura Barbs` — every enchantment stings its CONTROLLER, and every attached
// Aura stings its HOST: one Captive Flame on my side, one Pacifism on their
// Bears, and the Bears die of their own Aura.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AURA_BARBS_SCRIPT } from './auraBarbs';
import { AURA_BARBS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stung(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Aura Barbs', 'Captive Flame'], ['Pacifism', 'Grizzly Bears']],
    scripts: createRegistry([AURA_BARBS_SCRIPT]),
  });
  put(g, 'p1', 'Captive Flame');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  // The Aura is CAST at the Bears on ITS controller's turn — the real flow,
  // and the only one that leaves an attached Aura behind (CR 303.4g, D198;
  // an Aura merely PUT onto the battlefield dies unattached to the sweep).
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const pacifism = put(g, 'p2', 'Pacifism', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: pacifism }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Aura Barbs', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears };
}

describe('Aura Barbs', () => {
  test('each controller stung per enchantment; the Aura kills its own host', () => {
    const { g, bears } = stung();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AURA_BARBS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AURA_BARBS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AURA_BARBS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = stung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

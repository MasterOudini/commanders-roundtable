// `Rabid Bite` — the ONE-SIDED fight: the Strix dies to the Bears' 2, and
// the Bears take NOTHING back — the whole difference from Prey Upon,
// asserted from both sides of the same pairing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { RABID_BITE_SCRIPT } from './rabidBite';
import { RABID_BITE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bite(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rabid Bite', 'Grizzly Bears'], ['Baleful Strix']],
    scripts: createRegistry([RABID_BITE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Baleful Strix');
  settle(g);
  const spell = put(g, 'p1', 'Rabid Bite', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Rabid Bite', () => {
  test('the Strix dies; the Bears take nothing back — even from deathtouch', () => {
    const { g, mine, theirs } = bite();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = RABID_BITE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, RABID_BITE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(RABID_BITE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bite();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Churning Eddy` — BOTH targets go home: the creature and the land, each
// to its owner's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHURNING_EDDY_SCRIPT } from './churningEddy';
import { CHURNING_EDDY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function churned(): { g: Game; bears: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Churning Eddy'], ['Grizzly Bears', 'Mountain']],
    scripts: createRegistry([CHURNING_EDDY_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Churning Eddy', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'card', id: land },
      ],
    }),
  );
  settle(g);
  return { g, bears, land };
}

describe('Churning Eddy', () => {
  test('the creature AND the land go home', () => {
    const { g, bears, land } = churned();
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[land]?.zone.kind).toBe('hand');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHURNING_EDDY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHURNING_EDDY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHURNING_EDDY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = churned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

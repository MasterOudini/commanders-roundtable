// `Kami of Ancient Law` — its own body pays for the enchantment's death.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KAMI_OF_ANCIENT_LAW_SCRIPT } from './kamiOfAncientLaw';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KAMI = 'Kami of Ancient Law';
const LEVITATION = 'Levitation';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function destroyed(): { g: Game; kami: InstanceId; levitation: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KAMI, LEVITATION], []],
    scripts: createRegistry([KAMI_OF_ANCIENT_LAW_SCRIPT]),
  });
  const kami = put(g, 'p1', KAMI);
  const levitation = put(g, 'p1', LEVITATION);
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kami, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: levitation }] }));
  settle(g);
  return { g, kami, levitation };
}

describe('Kami of Ancient Law', () => {
  test('its own body pays and the chosen enchantment dies', () => {
    const { g, kami, levitation } = destroyed();
    expect(g.state.cards[kami]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[levitation]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = destroyed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

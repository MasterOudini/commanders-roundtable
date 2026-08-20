// `Lys Alana Informant` — the entry asks, and dying asks AGAIN: one
// line, both arms.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LYS_ALANA_INFORMANT_SCRIPT } from './lysAlanaInformant';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answerScry(g: Game): void {
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
  settle(g);
}

function informed(): { g: Game; informant: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Lys Alana Informant'], ['Grizzly Bears']],
    scripts: createRegistry([LYS_ALANA_INFORMANT_SCRIPT]),
  });
  settle(g);
  const informant = put(g, 'p1', 'Lys Alana Informant');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return { g, informant };
}

describe('Lys Alana Informant', () => {
  test('the entry asks; dying asks AGAIN', () => {
    const { g, informant } = informed();
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    answerScry(g);
    expect(g.state.priority.awaiting).toBeNull();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: informant,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    answerScry(g);
    expect(g.state.cards[informant]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = informed();
    answerScry(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

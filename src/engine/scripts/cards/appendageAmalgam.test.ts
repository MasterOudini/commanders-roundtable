// `Appendage Amalgam` — attacks → surveil 1: the self-attack filter raising
// the D195 ask with `toGraveyard: true`, so the send-away lands in the
// GRAVEYARD rather than on the bottom.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { APPENDAGE_AMALGAM_SCRIPT } from './appendageAmalgam';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Appendage Amalgam', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([APPENDAGE_AMALGAM_SCRIPT]),
  });
  const amalgam = put(g, 'p1', 'Appendage Amalgam');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: amalgam, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Appendage Amalgam', () => {
  test('attacking asks with toGraveyard SET, and the send-away lands there', () => {
    const { g, revealed } = attacked();
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    const card = revealed[0] as InstanceId;
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.graveyard['p1'] ?? []).includes(card)).toBe(true);
  });

  test('keeping it on top is the other real answer', () => {
    const { g, revealed } = attacked();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = attacked();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

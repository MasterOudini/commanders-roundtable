// `Cerebral Download` — surveil X (my artifacts) THEN draw three: the
// thenDraw rider draws past what the answer just binned, and the
// zero-artifact cast skips the ask but still draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CEREBRAL_DOWNLOAD_SCRIPT } from './cerebralDownload';
import { CEREBRAL_DOWNLOAD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(artifacts: number): { g: Game; before: number; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Cerebral Download', 'Sol Ring', 'Sol Ring'], ['Grizzly Bears']],
    scripts: createRegistry([CEREBRAL_DOWNLOAD_SCRIPT]),
  });
  for (let i = 0; i < artifacts; i++) put(g, 'p1', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cerebral Download', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  if (artifacts > 0) {
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  } else {
    settle(g);
  }
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, before, revealed };
}

describe('Cerebral Download', () => {
  test('two artifacts: surveil 2 with the graveyard flag, then the THREE draws land', () => {
    const { g, before, revealed } = cast(2);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count).toBe(2);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 3);
  });

  test('ZERO artifacts: no ask, the draws still happen', () => {
    const { g, before } = cast(0);
    expect(g.state.priority.awaiting).toBeNull();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CEREBRAL_DOWNLOAD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CEREBRAL_DOWNLOAD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CEREBRAL_DOWNLOAD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = cast(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

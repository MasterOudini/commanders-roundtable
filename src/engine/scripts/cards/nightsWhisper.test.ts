// `Night's Whisper` — two real draws through `drawEvents` (the D189 marker
// fires) and the 2 life. Draws counted in LIBRARY moves, not hand size —
// the Azorius Locket lesson (D163).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NIGHTS_WHISPER_SCRIPT } from './nightsWhisper';
import { NIGHT_S_WHISPER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [['Night\'s Whisper', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([NIGHTS_WHISPER_SCRIPT]),
  });
  const whisper = put(g, 'p1', 'Night\'s Whisper', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: whisper }));
  settle(g);
  return { g, libBefore };
}

describe("Night's Whisper", () => {
  test('draws two (the library loses exactly two) and loses 2 life', () => {
    const { g, libBefore } = cast();
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 2);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the D189 marker fires for exactly the two drawn cards', () => {
    const { g } = cast();
    const markers = g.log.filter((e) => e.body.t === 'DrewCards' && e.body.player === 'p1');
    const last = markers[markers.length - 1];
    expect(last && last.body.t === 'DrewCards' ? last.body.cards.length : 0).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NIGHT_S_WHISPER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NIGHT_S_WHISPER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NIGHT_S_WHISPER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Amnesia` — the target's hand is PUBLICLY revealed and every nonland goes
// to the graveyard; the lands stay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AMNESIA_SCRIPT } from './amnesia';
import { AMNESIA } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; bearsInHand: string } {
  const g = startedGame({
    players: 2,
    decks: [['Amnesia'], ['Mountain', 'Grizzly Bears']],
    scripts: createRegistry([AMNESIA_SCRIPT]),
  });
  // The opening hand can be all lands — plant a KNOWN nonland so the
  // discard has something to take.
  const bearsInHand = put(g, 'p2', 'Grizzly Bears', 'hand');
  const spell = put(g, 'p1', 'Amnesia', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bearsInHand };
}

describe('Amnesia', () => {
  test('every nonland leaves the hand; every land stays; the reveal was public', () => {
    const { g, bearsInHand } = cast();
    const hand = g.state.zones.hand['p2'] ?? [];
    for (const id of hand) {
      const inst = g.state.cards[id];
      const face = inst ? ORACLE.byPrinting(inst.printingId)?.data.faces[0] : undefined;
      expect(face?.typeLine ?? '').toMatch(/Land/);
      expect(inst?.revealedTo.includes('p1')).toBe(true);
    }
    expect(g.state.cards[bearsInHand]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AMNESIA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AMNESIA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AMNESIA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

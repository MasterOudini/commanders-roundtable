// `Destroy the Evidence` — the land dies, and the controller's library
// turns over from the top until the first land, the run milled whole. The
// top is ENGINEERED (a nonland stacked over a land) so the run length is
// exact; the reveal is asserted ON THE LOG (moves clear `revealedTo`).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DESTROY_THE_EVIDENCE_SCRIPT } from './destroyTheEvidence';
import { DESTROY_THE_EVIDENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function evidenced(): { g: Game; land: InstanceId; bears: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Destroy the Evidence'], ['Grizzly Bears', 'Mountain', 'Mountain']],
    scripts: createRegistry([DESTROY_THE_EVIDENCE_SCRIPT]),
  });
  const target = put(g, 'p2', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  const mine = put(g, 'p2', 'Mountain', 'hand');
  settle(g);
  holdEverywhere(g);
  // Stack the top of p2's library: the land goes on top first, then the
  // nonland OVER it — the run is exactly [Bears, Mountain].
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: mine,
      to: { kind: 'library', player: 'p2' },
      placement: 'top',
    }),
  );
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: bears,
      to: { kind: 'library', player: 'p2' },
      placement: 'top',
    }),
  );
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Destroy the Evidence', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, land: target, bears, mine };
}

describe('Destroy the Evidence', () => {
  test('the land dies; the run stops AT the first land and is milled whole', () => {
    const { g, land, bears, mine } = evidenced();
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    const reveal = g.log.find(
      (e) => e.body.t === 'CardsRevealed' && e.body.cards.includes(bears),
    );
    expect(reveal).toBeDefined();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DESTROY_THE_EVIDENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DESTROY_THE_EVIDENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DESTROY_THE_EVIDENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = evidenced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

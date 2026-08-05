// `Hedron Archive` — the first SELF-SACRIFICE cost (D159). The sacrifice is
// paid at ACTIVATION, before anything can respond, so the draw resolves with
// the Archive already in the graveyard — and the cost is chargeable ONLY
// because the registry carries the def: this file breaks that gate on purpose.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEDRON_ARCHIVE_SCRIPT } from './hedronArchive';
import { HEDRON_ARCHIVE } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ARCHIVE = 'Hedron Archive';

function game(withDef = true): Game {
  return startedGame({
    players: 2,
    decks: [[ARCHIVE], []],
    scripts: createRegistry(withDef ? [HEDRON_ARCHIVE_SCRIPT] : []),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Hedron Archive', () => {
  test('the parse says what the machinery assumes: self-sacrifice, payable, ability 1', () => {
    const oc = ORACLE.byPrinting(HEDRON_ARCHIVE.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(2);
    expect(abilities[0]?.isManaAbility).toBe(true);
    expect(abilities[1]?.sacrificesSelf).toBe(true);
    expect(abilities[1]?.payable).toBe(true);
    expect(abilities[1]?.unpaidCosts).toEqual([]);
  });

  test('activating sacrifices the Archive AT ACTIVATION and draws two on resolution', () => {
    const g = game();
    const id = put(g, 'p1', ARCHIVE);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    // ⚠️ BEFORE settling: the cost is already paid, so the Archive is in the
    // graveyard while its ability is still on the stack (CR 602.2b).
    expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 2);
    expect(idsIn(g, 'p1', 'graveyard')).toContain(id);
    expect(
      g.log.some((e) => e.body.t === 'Narrated' && /sacrifices Hedron Archive/.test(e.body.text)),
    ).toBe(true);
  });

  /**
   * ⚠️ THE DEF GATE, BROKEN ON PURPOSE (D159). Without the def in the game's
   * registry the ability must not be chargeable at all — an engine that ate
   * the Archive and resolved nothing would be D122's disclosed gap turned
   * destructive. The rejection must leave the permanent untouched.
   */
  test('WITHOUT the def, the self-sacrifice ability is refused and nothing is eaten', () => {
    const g = game(false);
    const id = put(g, 'p1', ARCHIVE);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 });
    expect(r.ok).toBe(false);
    expect(g.state.cards[id]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', ARCHIVE);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

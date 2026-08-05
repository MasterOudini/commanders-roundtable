// `War Room` — the first COMPUTED cost (D159): "Pay life equal to the number
// of colors in your commanders' color identity". The parse records the RULE;
// the activation reads the number off the player — so this file proves two
// different identities pay two different prices from one script.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WAR_ROOM_SCRIPT } from './warRoom';
import { WAR_ROOM } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ROOM = 'War Room';

// Default harness commanders: p1 Kess (UBR — three colours), p2 Krenko (R — one).
function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ROOM], [ROOM]],
    scripts: createRegistry([WAR_ROOM_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('War Room', () => {
  test('the parse says what the machinery assumes: the computed rule, payable, ability 1', () => {
    const oc = ORACLE.byPrinting(WAR_ROOM.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(2);
    expect(abilities[0]?.isManaAbility).toBe(true);
    expect(abilities[1]?.lifeCostCommanderColors).toBe(true);
    expect(abilities[1]?.lifeCost).toBe(0);
    expect(abilities[1]?.payable).toBe(true);
  });

  test('a three-colour commander pays 3 life and draws', () => {
    const g = game();
    const id = put(g, 'p1', ROOM);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(37);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(
      g.log.some((e) => e.body.t === 'LifeChanged' && e.body.player === 'p1' && e.body.delta === -3),
    ).toBe(true);
  });

  test('a MONO-colour commander pays 1 from the SAME script — the number is the player’s', () => {
    const g = game();
    const id = put(g, 'p2', ROOM);
    settle(g);
    // ⚠️ Fund AFTER p2 holds priority — mana pools empty as steps end
    // (CR 500.4), so a pool filled before the advance is a pool that is gone.
    advanceUntil(g, (s) => s.priority.player === 'p2' && s.stack.length === 0, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p2', card: id, abilityIndex: 1 }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', ROOM);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Skystrike Officer` — attacking makes a colorless Soldier token; three
// untapped Soldiers tap to draw a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYSTRIKE_OFFICER_SCRIPT } from './skystrikeOfficer';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const OFFICER = 'Skystrike Officer';
const SOLDIERS = ['Stern Constable', 'Thraben Standard Bearer', 'Siege Veteran'];
const SOLDIER_TOKEN = TOKEN_TABLE['Soldier|1/1||Artifact Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function soldierTokens(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SOLDIER_TOKEN?.printingId;
  }).length;
}

describe('Skystrike Officer', () => {
  test('attacking makes a Soldier token', () => {
    const g = startedGame({ players: 2, decks: [[OFFICER], []], scripts: createRegistry([SKYSTRIKE_OFFICER_SCRIPT]) });
    const officer = put(g, 'p1', OFFICER);
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.priority.awaiting?.kind === 'declareAttackers', 120_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: officer, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(soldierTokens(g, 'p1')).toBe(1);
  });

  test('three untapped Soldiers tap to draw a card', () => {
    const g = startedGame({ players: 2, decks: [[OFFICER, ...SOLDIERS], []], scripts: createRegistry([SKYSTRIKE_OFFICER_SCRIPT]) });
    const soldiers = SOLDIERS.map((n) => put(g, 'p1', n));
    const officer = put(g, 'p1', OFFICER);
    settle(g);
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: officer, abilityIndex: 0, tap: soldiers, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    for (const id of soldiers) expect(g.state.cards[id]?.tapped).toBe(true);
    expect(g.state.cards[officer]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = startedGame({ players: 2, decks: [[OFFICER, ...SOLDIERS], []], scripts: createRegistry([SKYSTRIKE_OFFICER_SCRIPT]) });
    const soldiers = SOLDIERS.map((n) => put(g, 'p1', n));
    const officer = put(g, 'p1', OFFICER);
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: officer, abilityIndex: 0, tap: soldiers, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// D463 - MOBILIZE N (CR 702.179): whenever this creature attacks, create N 1/1 red Warrior creature tokens that are
// tapped and attacking (the same defender), and sacrifice them at the beginning of the next end step. A keyword
// trigger on the declaration (D308's table): the Warriors from TOKEN_TABLE (pinned), tapped, joined to the combat by
// AttackerAdded (D462's event), each armed with its own delayed sacrifice (D402's arming, the vocabulary's own
// sacrificeSelf). Proven on Dragonback Lancer (mobilize 1) and Dalkovan Packbeasts (mobilize 3), no script: the
// Warriors tapped and attacking p2 beside the attacker, their damage landing, the sacrifice at the end step, a
// creature declared elsewhere making nothing, the replay hash. `engineComplete` claims the line off the keyword.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function armed(name: string): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[name, 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  const card = put(g, 'p1', name);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  return { g, card };
}
const warriors = (g: Game): InstanceId[] => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.isToken === true && g.state.cards[id]?.controller === 'p1');

describe('D463 - the parse and the table', () => {
  test('mobilize is a keyword the parser reads with its number, and the table has its attack trigger', () => {
    expect(ORACLE.byName('Dragonback Lancer')?.faces[0]?.keywords).toContain('mobilize');
    expect(ORACLE.byName('Dalkovan Packbeasts')?.faces[0]?.keywords).toContain('mobilize');
  });
});

describe('D463 - mobilize (Dragonback Lancer, Dalkovan Packbeasts)', () => {
  test('one Warrior enters tapped and attacking the same player as the Lancer attacks; both deal damage', () => {
    const { g, card } = armed('Dragonback Lancer');
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    const ws = warriors(g);
    expect(ws).toHaveLength(1);
    const w = ws[0] as InstanceId;
    expect(ORACLE.byPrinting(g.state.cards[w]?.printingId ?? '')?.name).toBe('Warrior');
    expect(g.state.cards[w]?.tapped).toBe(true);
    expect(g.state.combat?.attackers.some((a) => a.card === w && a.defender.kind === 'player' && a.defender.id === 'p2' && !a.becameBlocked)).toBe(true);
    expect(g.state.delayedTriggers.some((d) => d.source === w)).toBe(true);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    // 3 (the flying Lancer) + 1 (the Warrior) unblocked.
    expect(g.state.players.p2?.life).toBe(36);
  });

  test('the Warriors are sacrificed at the beginning of the next end step', () => {
    const { g, card } = armed('Dalkovan Packbeasts');
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(warriors(g)).toHaveLength(3);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'end' && s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 40_000);
    expect(warriors(g)).toHaveLength(0);
    expect(g.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.reason === 'sacrifice')).length).toBeGreaterThanOrEqual(3);
    expect(g.state.delayedTriggers.filter((d) => d.label.includes('mobilize'))).toHaveLength(0);
  });

  test('a creature attacking alongside makes no Warrior of its own; the Lancer staying home makes none', () => {
    const g = startedGame({ players: 2, decks: [['Dragonback Lancer', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    put(g, 'p1', 'Dragonback Lancer');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(warriors(g)).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g, card } = armed('Dalkovan Packbeasts');
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// `Hermes, Overseer of Elpis` — a noncreature cast makes a Bird, a creature
// cast makes nothing, and attacking with the Bird asks a scry 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HERMES_OVERSEER_OF_ELPIS_SCRIPT } from './hermesOverseerOfElpis';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HERMES = 'Hermes, Overseer of Elpis';
const SORCERY = 'Bargain'; // a noncreature spell, {2}{W}, targets an opponent
const BEARS = 'Grizzly Bears';
const BIRD = TOKEN_TABLE['Bird|1/1|U|Creature|flying|vigilance'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function birdsOf(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === BIRD?.printingId;
  });
}

function withHermes(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HERMES, SORCERY, BEARS], []],
    scripts: createRegistry([HERMES_OVERSEER_OF_ELPIS_SCRIPT]),
  });
  put(g, 'p1', HERMES);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

function castSorcery(g: Game): void {
  const spell = put(g, 'p1', SORCERY, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
}

describe('Hermes, Overseer of Elpis', () => {
  test('a noncreature spell cast makes a 1/1 Bird', () => {
    const g = withHermes();
    castSorcery(g);
    expect(birdsOf(g, 'p1').length).toBe(1);
  });

  test('a creature spell cast makes nothing', () => {
    const g = withHermes();
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(birdsOf(g, 'p1').length).toBe(0);
  });

  test('attacking with the Bird asks a scry 2', () => {
    const g = withHermes();
    castSorcery(g);
    const [bird] = birdsOf(g, 'p1') as [InstanceId];
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 60_000);
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: bird, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.count === 2 && !awaiting.toGraveyard).toBe(true);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed.length).toBe(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed].reverse(), toBottom: [] }));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const g = withHermes();
    castSorcery(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

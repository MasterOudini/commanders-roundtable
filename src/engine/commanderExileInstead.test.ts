// CR 903.9a - THE COMMANDER'S QUESTION NAMES THE ZONE IT WENT TO. A commander that "would die" and is exiled instead
// (D413's mark: Scorching Dragonfire, Lava Coil) was asked about the GRAVEYARD: the commander rule read the move before
// `withExileInsteadOfDying` rewrote it, so the question said graveyard while the card sat in exile - and the answer
// handler, which moves it only from the recorded zone, made a "yes" a silent no-op (CR 903.9a's choice denied). Each
// test failed before the fix (reproduced 2026-09-29 at master 29ae46f0).
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';

describe("the commander's question names the zone the commander went to", () => {
  for (const spell of ['Scorching Dragonfire', 'Lava Coil']) {
    test(`${spell} exiles a dying commander instead: the question is about exile, and yes sends it home`, () => {
      const g = startedGame({ players: 2, decks: [[spell], []] });
      const card = put(g, 'p1', spell, 'hand');
      const krenko = put(g, 'p2', 'Krenko, Mob Boss');
      advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
      holdEverywhere(g);
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
      must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: krenko }] }));
      advanceUntil(g, (s) => s.priority.awaiting !== null, 20_000);
      expect(g.state.cards[krenko]?.zone.kind, 'exiled instead of dying').toBe('exile');
      const ask = g.state.priority.awaiting;
      if (ask?.kind !== 'commanderZoneChoice') throw new Error("expected the commander's question, got " + (ask?.kind ?? 'none'));
      expect(ask.player).toBe('p2');
      expect(ask.queue[0]?.card).toBe(krenko);
      expect(ask.queue[0]?.from.kind, 'the zone it went to').toBe('exile');
      must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
      expect(g.state.cards[krenko]?.zone.kind, 'a yes sends it home').toBe('command');
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    });
  }
});

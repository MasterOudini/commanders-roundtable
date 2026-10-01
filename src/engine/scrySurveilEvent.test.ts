// D600 - THE SCRY AND SURVEIL EVENTS: `Whenever you scry` (Elminster, Chance-Met Elves, Flamespeaker Adept ...) and
// `Whenever you surveil` (Dimir Spybug, Thoughtbound Phantasm ...) - a trigger on the act itself (CR 701.22 / 701.25), and
// the engine emitted nothing a trigger could match: the scry's answer moved the cards and narrated, no event said "this
// player scried". `Scried` / `Surveilled` are markers the answer emits beside its moves (the reducer ignores them) - for a
// real scry or surveil only: an explore's reveal and a clash's placement borrow the scry prompt and are neither. What is
// proven: Opt's scry and Consider's surveil each emit their marker once, with the player and the number looked at; the
// hash replays.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];

function cast(spell: string): { g: Game } {
  const g = startedGame({ players: 2, decks: [[spell, ...TEN], ['Walking Corpse', ...TEN]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const card = put(g, 'p1', spell, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = [...(g.state.zones.library.p1 ?? [])] as InstanceId[];
  const shown = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: shown, toBottom: [] }));
  settle(g);
  return { g };
}

describe('D600 - the scry and surveil events', () => {
  test("Opt's scry emits Scried once: the player, the number looked at", () => {
    const { g } = cast('Opt');
    const marks = g.log.filter((x) => x.body.t === 'Scried');
    expect(marks).toHaveLength(1);
    const b = marks[0]?.body;
    expect(b && b.t === 'Scried' ? [b.player, b.amount] : null).toEqual(['p1', 1]);
    expect(g.log.some((x) => x.body.t === 'Surveilled')).toBe(false);
  });

  test("Consider's surveil emits Surveilled once, never Scried", () => {
    const { g } = cast('Consider');
    const marks = g.log.filter((x) => x.body.t === 'Surveilled');
    expect(marks).toHaveLength(1);
    const b = marks[0]?.body;
    expect(b && b.t === 'Surveilled' ? [b.player, b.amount] : null).toEqual(['p1', 1]);
    expect(g.log.some((x) => x.body.t === 'Scried')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = cast('Opt');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

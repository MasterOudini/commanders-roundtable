// D570 - DEVOUR N (CR 702.82a): "As this object enters, you may sacrifice any number of creatures. This permanent enters
// with N +1/+1 counters on it for each creature sacrificed this way." Asked through D136's entry prompt - `entersChoice`
// with a `devour` field: N and the candidates, read by the funnel off the board BEFORE the move, so neither the devourer
// nor a creature entering beside it is ever among them. The answer names the picks (one sacrifice, then N counters for
// each); declined, nothing moves and nothing taps; no candidate, no question. What is proven here: the reading (the plain
// line is the keyword's and accounted, the quality variant is not); Predator Dragon (Devour 2) asked with the two Bears
// as its candidates - both eaten, four counters; declined - the Bears stay, no counters, untapped; alone - unasked; a
// pick outside the prompt (an opponent's creature, the Dragon itself, one named twice) refused, and `pay` with none; two
// creatures entering in one move - the other is no candidate; the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { NO_SCRIPTS } from './scripts/registryCore';
import { findAnywhere, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { parseDevour } from './keywords';
import { applyReplacements } from './triggers';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
function game(p1: readonly string[], p2: readonly string[] = []): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...FORESTS], [...p2, ...FORESTS]], options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
function asked(g: Game) {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'entersChoice') throw new Error(`expected the entry choice, got ${a?.kind ?? 'none'}`);
  if (a.devour === undefined) throw new Error('expected a devour ask');
  expect(a.life).toBe(0);
  return a;
}
const zoneOf = (g: Game, id: InstanceId) => {
  const c = g.state.cards[id];
  if (!c) throw new Error(`no card ${id}`);
  return c.zone;
};

describe('devour (D570)', () => {
  test('the reading: the plain line is the keyword, the variants are not; the keyword-only cards are accounted', () => {
    expect(parseDevour('Devour 2 (As this creature enters, you may sacrifice any number of creatures. This creature enters with twice that many +1/+1 counters on it.)')).toBe(2);
    expect(parseDevour('Flying\nDevour 1')).toBe(1);
    expect(parseDevour('Devour artifact 1')).toBeNull();
    expect(parseDevour('Devour X, where X is the number of creatures devoured this way')).toBeNull();
    expect(ORACLE.byName('Predator Dragon')?.faces[0]?.keywords).toContain('devour');
    expect(ORACLE.byName('Caprichrome')?.faces[0]?.keywords ?? []).not.toContain('devour');
    for (const name of ['Predator Dragon', 'Gorger Wurm']) {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error(`no fixture ${name}`);
      expect(unaccountedLines(card, 0), name).toEqual([]);
    }
    const capri = ENGINE_CARDS.find((c) => c.name === 'Caprichrome');
    if (!capri) throw new Error('no fixture Caprichrome');
    expect(unaccountedLines(capri, 0).some((l) => l.text.startsWith('Devour artifact 1')), 'the quality variant stays a leftover').toBe(true);
  });

  test('Predator Dragon enters: asked with the two Bears, both devoured - four +1/+1 counters, the Bears in the graveyard', () => {
    const g = game(['Grizzly Bears', 'Grizzly Bears', 'Predator Dragon'], ['Grizzly Bears']);
    const a = put(g, 'p1', 'Grizzly Bears');
    const b = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    const dragon = put(g, 'p1', 'Predator Dragon');
    const ask = asked(g);
    expect(ask.source).toBe(dragon);
    expect(ask.player).toBe('p1');
    expect(ask.devour).toEqual({ n: 2, candidates: [a, b] });
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: dragon, pay: true, devour: [a, b] }));
    expect([g.state.cards[a]?.zone.kind, g.state.cards[b]?.zone.kind, g.state.cards[theirs]?.zone.kind]).toEqual(['graveyard', 'graveyard', 'battlefield']);
    expect(g.state.cards[dragon]?.counters['+1/+1']).toBe(4);
    expect(g.state.cards[dragon]?.tapped).toBe(false);
    expect(g.state.priority.awaiting).toBeNull();
    const moved = g.log.find((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === a && m.reason === 'sacrifice'));
    expect(moved?.body.t === 'CardsMoved' ? moved.body.moves.map((m) => [m.card, m.reason]) : null, 'one move, both sacrifices').toEqual([[a, 'sacrifice'], [b, 'sacrifice']]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined: nothing is sacrificed, nothing taps, no counters', () => {
    const g = game(['Grizzly Bears', 'Predator Dragon']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const dragon = put(g, 'p1', 'Predator Dragon');
    asked(g);
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: dragon, pay: false }));
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dragon]?.counters['+1/+1']).toBeUndefined();
    expect(g.state.cards[dragon]?.tapped).toBe(false);
    expect(g.state.priority.awaiting).toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('with no creature of its controller to devour, nobody is asked and it enters bare', () => {
    const g = game(['Predator Dragon'], ['Grizzly Bears']);
    put(g, 'p2', 'Grizzly Bears');
    const dragon = put(g, 'p1', 'Predator Dragon');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.cards[dragon]?.counters['+1/+1']).toBeUndefined();
  });

  test('refused: an opponent creature, the Dragon itself, a creature named twice, and pay with none; then one devoured', () => {
    const g = game(['Grizzly Bears', 'Predator Dragon'], ['Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    const dragon = put(g, 'p1', 'Predator Dragon');
    asked(g);
    const answer = (devour?: readonly InstanceId[]) =>
      g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: dragon, pay: true, ...(devour !== undefined ? { devour } : {}) });
    expect(answer([theirs]).ok).toBe(false);
    expect(answer([dragon]).ok).toBe(false);
    expect(answer([bears, bears]).ok).toBe(false);
    expect(answer().ok).toBe(false);
    expect(answer([]).ok).toBe(false);
    must(answer([bears]));
    expect(g.state.cards[dragon]?.counters['+1/+1']).toBe(2);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two creatures entering in one move: the other is no candidate - only the creature already there', () => {
    const g = game(['Grizzly Bears', 'Grizzly Bears', 'Predator Dragon']);
    const old = put(g, 'p1', 'Grizzly Bears');
    const fresh = findAnywhere(g, 'p1', 'Grizzly Bears');
    const dragon = findAnywhere(g, 'p1', 'Predator Dragon');
    const out = applyReplacements(g.state, ORACLE, NO_SCRIPTS, {
      t: 'CardsMoved',
      moves: [
        { card: fresh, from: zoneOf(g, fresh), to: { kind: 'battlefield', player: 'p1' } },
        { card: dragon, from: zoneOf(g, dragon), to: { kind: 'battlefield', player: 'p1' } },
      ],
    });
    const set = out.find((e) => e.t === 'AwaitingSet');
    const ask = set?.t === 'AwaitingSet' ? set.awaiting : null;
    expect(ask?.kind === 'entersChoice' ? [ask.source, ask.devour] : null).toEqual([dragon, { n: 2, candidates: [old] }]);
  });
});

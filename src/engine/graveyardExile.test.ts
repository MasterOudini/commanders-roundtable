// D617 - THE GRAVEYARD EXILE AND THE MASS EXILE: a whole graveyard into exile (`Exile target player's graveyard.`,
// `Exile each opponent's graveyard.`, `Exile all graveyards.`), the wide scope's members into exile (`Exile all
// creatures.`), and `Target player gains N life.` - the aimed player.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, fullControl, must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BALM = 'Soothing Balm';
const MORNINGTIDE = 'Morningtide';
const JUDGMENT = 'Final Judgment';
const CRYPT = "Tormod's Crypt";

function mana(g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
}

function bury(g: Game, player: 'p1' | 'p2', n: number): InstanceId[] {
  const out: InstanceId[] = [];
  for (let i = 0; i < n; i++) {
    const top = (g.state.zones.library[player] ?? [])[0];
    if (!top) break;
    must(g.submit({ t: 'ManualMoveCard', player, card: top, to: { kind: 'graveyard', player } }));
    out.push(top);
  }
  return out;
}

function resolve(g: Game, id: InstanceId): void {
  advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
}

describe('the graveyard exile, the mass exile, the aimed life gain (D617)', () => {
  test('the reads', () => {
    const kinds = (t: string) => parseEffects(t, 'Morningtide', true).effects.map((e) => [e.kind, e.targetIndex, e.scopes?.[0]?.kind === 'player' ? e.scopes[0].controller : null]);
    expect(kinds("Exile target player's graveyard.")).toEqual([['exileGraveyard', 0, null]]);
    expect(kinds("Exile each opponent's graveyard.")).toEqual([['exileGraveyard', -1, 'opponents']]);
    expect(kinds('Exile all graveyards.')).toEqual([['exileGraveyard', -1, 'any']]);
    expect(kinds('Exile all cards from all graveyards.')).toEqual([['exileGraveyard', -1, 'any']]);
    expect(kinds('Exile all creatures.')).toEqual([['exileAll', -1, null]]);
    expect(kinds('Target player gains 5 life.')).toEqual([['gainLife', 0, null]]);
  });

  test('every graveyard goes to exile, and the spell itself to its graveyard after', () => {
    const g = startedGame({ decks: [['Plains', 'Plains', 'Plains', MORNINGTIDE], ['Forest', 'Forest', 'Forest']] });
    fullControl(g, 'p1');
    const mine = bury(g, 'p1', 2);
    const theirs = bury(g, 'p2', 2);
    const id = put(g, 'p1', MORNINGTIDE, 'hand');
    mana(g, 'W', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id }));
    resolve(g, id);
    for (const c of [...mine, ...theirs]) expect(g.state.cards[c]?.zone.kind).toBe('exile');
    expect(g.state.zones.graveyard.p2 ?? []).toEqual([]);
    expect(g.state.zones.graveyard.p1 ?? []).toEqual([id]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the aimed graveyard alone', () => {
    const card = ORACLE.byName(CRYPT);
    if (!card) throw new Error('no fixture');
    const payload = "Exile target player's graveyard.";
    const effects = vocabularyEffects(payload, CRYPT);
    const targets = vocabularyTargets(payload);
    const script: CardScript = { oracleId: card.oracleId, name: CRYPT, activated: [{ ref: card.oracleId + '#a0', text: card.faces[0]?.oracleText ?? '', ...(targets.length > 0 ? { targets } : {}), resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets) }] };
    const g = startedGame({ decks: [['Swamp', 'Swamp', 'Swamp', CRYPT], ['Forest', 'Forest', 'Forest']], scripts: createRegistry([script]) });
    fullControl(g, 'p1');
    const mine = bury(g, 'p1', 1);
    const theirs = bury(g, 'p2', 2);
    const id = put(g, 'p1', CRYPT);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    for (const c of theirs) expect(g.state.cards[c]?.zone.kind).toBe('exile');
    for (const c of mine) expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[id]?.zone.kind, 'the Crypt sacrificed').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('every creature goes to exile', () => {
    const g = startedGame({ decks: [['Plains', 'Grizzly Bears', JUDGMENT], ['Forest', 'Grizzly Bears']] });
    fullControl(g, 'p1');
    const a = put(g, 'p1', 'Grizzly Bears');
    const b = put(g, 'p2', 'Grizzly Bears');
    const land = put(g, 'p1', 'Plains');
    const id = put(g, 'p1', JUDGMENT, 'hand');
    mana(g, 'W', 2);
    mana(g, 'C', 4);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id }));
    resolve(g, id);
    expect(g.state.cards[a]?.zone.kind).toBe('exile');
    expect(g.state.cards[b]?.zone.kind).toBe('exile');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
  });

  test('the aimed player gains the life', () => {
    const g = startedGame({ decks: [['Plains', BALM], ['Forest']] });
    fullControl(g, 'p1');
    const id = put(g, 'p1', BALM, 'hand');
    const p1 = g.state.players.p1?.life ?? 0;
    const p2 = g.state.players.p2?.life ?? 0;
    mana(g, 'W', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, targets: [{ kind: 'player', id: 'p2' }] }));
    resolve(g, id);
    expect(g.state.players.p2?.life).toBe(p2 + 5);
    expect(g.state.players.p1?.life).toBe(p1);
  });
});

// Typed spell targets (D198): "counter target artifact spell" used to parse
// CONFIDENT to battlefield kinds ['artifact'] — the word "spell" silently
// dropped, the aim veil pointing a counterspell at PERMANENTS. The spec now
// reads kinds:['spell'] with ENFORCED cardTypes, both candidate adapters
// carry the CAST FACE's types, and the effect vocabulary admits the wording
// only because the enforcement landed first (D139's order).
//
// `Annul` and `Artifact Blast` are the batch's two VOCABULARY cards — no
// script anywhere; the whole card is the one admitted clause.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { parseTargetClauses } from '../data/targetParse';
import { parseEffects } from '../data/effectParse';
import { SHIPPED_REGISTRY } from './scripts/registry';
import { ANNUL, ARTIFACT_BLAST } from '../data/fixtures/engineCards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2 casts `theirs` on their own turn and the window stays open for p1. */
function held(theirs: string, mana: { symbol: 'G' | 'C'; amount: number }): { g: Game; spell: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [['Annul', 'Artifact Blast'], [theirs, 'Grizzly Bears']],
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p2', theirs, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: mana.symbol, amount: mana.amount }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === spell)?.id as string;
  return { g, spell, stackId };
}

describe('typed spell targets (D198)', () => {
  test('the specs read the STACK with the type enforced, nothing unenforced', () => {
    const annul = parseTargetClauses(ANNUL.faces[0]?.oracleText ?? '');
    expect(annul[0]?.kinds).toEqual(['spell']);
    expect(annul[0]?.cardTypes).toEqual(['Artifact', 'Enchantment']);
    expect(annul[0]?.unenforced).toEqual([]);
    const blast = parseTargetClauses(ARTIFACT_BLAST.faces[0]?.oracleText ?? '');
    expect(blast[0]?.kinds).toEqual(['spell']);
    expect(blast[0]?.cardTypes).toEqual(['Artifact']);
    // The symmetric upgrade: "creature spell" is enforced now too (D140's rule).
    const essence = parseTargetClauses('Counter target creature spell.');
    expect(essence[0]?.cardTypes).toEqual(['Creature']);
    expect(essence[0]?.unenforced).toEqual([]);
  });

  test('both cards are VOCABULARY cards — auto, and no script may shadow them', () => {
    for (const card of [ANNUL, ARTIFACT_BLAST]) {
      expect(parseEffects(card.faces[0]?.oracleText ?? '', card.name, true).mode).toBe('auto');
      expect(SHIPPED_REGISTRY.spell(card.oracleId)).toBeUndefined();
    }
  });

  test('Annul counters a held ARTIFACT spell — the card goes to the graveyard uncast', () => {
    const { g, spell, stackId } = held('Sol Ring', { symbol: 'C', amount: 1 });
    const annul = put(g, 'p1', 'Annul', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: annul }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.zones.battlefield.includes(spell)).toBe(false);
  });

  test('a CREATURE spell is REFUSED at the aim — the enforcement negative', () => {
    const { g, stackId } = held('Grizzly Bears', { symbol: 'G', amount: 2 });
    const annul = put(g, 'p1', 'Annul', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: annul }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const verdict = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] });
    expect(verdict.ok).toBe(false);
  });

  test('Artifact Blast counters an artifact spell and replays to the same hash', () => {
    const { g, spell, stackId } = held('Sol Ring', { symbol: 'C', amount: 1 });
    const blast = put(g, 'p1', 'Artifact Blast', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: blast }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

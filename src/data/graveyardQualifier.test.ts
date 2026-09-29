// A GRAVEYARD PHRASE D138's reader did not know - "from a single graveyard", "from graveyards", "from that player's
// graveyard", "from their graveyard", "in graveyards" ... - was dropped silently from a CARD target clause: `zones`
// stayed [] (so an exiled card was a legal target) and nothing was recorded (so tier3.ts said nothing). Measured over
// every Commander-legal card (2026-09-29): 73 clauses in ten shapes, none of them on an engine-complete card. Now the
// ZONE is enforced for every shape (each names a graveyard), and what the spec cannot say - an owner relative to another
// object ("that player's", "their", "defending player's", "target player's") or one graveyard shared by every pick ("a
// single graveyard", "a player's graveyard") - is RECORDED in `unenforced` (D138; D79: never blocking a legal choice -
// the controller stays open). "graveyards" is any graveyard: the zone alone, nothing left to record.
import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from './targetParse';
import { tier3NotesFor } from './tier3';
import { ENGINE_CARDS } from './fixtures/engineCards';
import type { CardData } from './cardTypes';
import type { TargetSpec } from '../engine/types/oracle';
import { targetAllowed, type TargetCandidate } from '../engine/targets';

/** The printed lines (verbatim from the card database) and the graveyard phrase each clause must record ('' = none). */
const LINES: readonly { readonly card: string; readonly line: string; readonly recorded: string }[] = [
  { card: 'Rapid Decay', line: 'Exile up to three target cards from a single graveyard.', recorded: 'from a single graveyard' },
  { card: 'Faerie Macabre', line: 'Discard this card: Exile up to two target cards from graveyards.', recorded: '' },
  { card: 'Ink-Eyes, Servant of Oni', line: "Whenever Ink-Eyes deals combat damage to a player, you may put target creature card from that player's graveyard onto the battlefield under your control.", recorded: "from that player's graveyard" },
  { card: "Gaea's Blessing", line: 'Target player shuffles up to three target cards from their graveyard into their library.', recorded: 'from their graveyard' },
  { card: 'Graven Abomination', line: "Whenever this creature attacks, exile target card from defending player's graveyard.", recorded: "from defending player's graveyard" },
  { card: 'Turn the Earth', line: 'Choose up to three target cards in graveyards. The owners of those cards shuffle them into their libraries. You gain 2 life.', recorded: '' },
  { card: 'Goblin Welder', line: "{T}: Choose target artifact a player controls and target artifact card in that player's graveyard. If both targets are still legal as this ability resolves, that player simultaneously sacrifices the artifact and returns the artifact card to the battlefield.", recorded: "in that player's graveyard" },
  { card: 'Suffer the Past', line: "Exile X target cards from target player's graveyard. For each card exiled this way, that player loses 1 life and you gain 1 life.", recorded: "from target player's graveyard" },
  { card: 'Mysterious Stranger', line: 'When this creature enters, for each graveyard with an instant or sorcery card in it, exile target instant or sorcery card from that graveyard. If two or more cards are exiled this way, choose one of them at random and copy it. You may cast the copy without paying its mana cost.', recorded: 'from that graveyard' },
  { card: 'Lodestone Bauble', line: "{1}, {T}, Sacrifice this artifact: Put up to four target basic land cards from a player's graveyard on top of their library in any order. That player draws a card at the beginning of the next turn's upkeep.", recorded: "from a player's graveyard" },
  { card: 'Command the Dreadhorde', line: 'Choose any number of target creature and/or planeswalker cards in graveyards. Command the Dreadhorde deals damage to you equal to the total mana value of those cards. Put them onto the battlefield under your control.', recorded: '' },
];

/** The one CARD clause of a line (the others aim at players or permanents). */
function cardClause(line: string): TargetSpec {
  const cards = parseTargetClauses(line).filter((s) => s.kinds.includes('card'));
  expect(cards, line).toHaveLength(1);
  return cards[0]!;
}

/** A card in a zone as a target candidate - a flat record, the shape both adapters build. */
function candidate(zone: 'graveyard' | 'exile'): TargetCandidate {
  return {
    choice: { kind: 'card', id: 'c-' + zone },
    zone,
    controller: 'p2',
    kinds: ['card'],
    types: ['Creature'],
    manaValue: 2,
    power: 2,
    toughness: 2,
    colors: ['G'],
    keywords: [],
    combat: { attacking: false, blocking: false },
    supertypes: [],
    subtypes: [],
    tapped: false,
    isToken: false,
    hexproof: false,
    shroud: false,
    protection: { colors: [], fromEverything: false, other: [] },
  };
}

describe('a graveyard phrase on a card target: the zone enforced, the rest recorded', () => {
  for (const { card, line, recorded } of LINES) {
    test(`${card}: "${recorded || 'graveyards - the zone alone'}"`, () => {
      const spec = cardClause(line);
      expect(spec.zones, 'the zone is the graveyard').toEqual(['graveyard']);
      expect(spec.unenforced, 'what the spec cannot say is recorded').toEqual(recorded === '' ? [] : [recorded]);
      expect(spec.controller, 'the owner stays open - an unread restriction never blocks').toBe('any');
    });
  }

  test('the zone is enforced: a card in a graveyard is admitted, an exiled one is not', () => {
    const src = { controller: 'p1', colors: [] } as const;
    for (const line of ['Discard this card: Exile up to two target cards from graveyards.', 'Exile up to three target cards from a single graveyard.']) {
      const spec = cardClause(line);
      expect(targetAllowed(spec, src, candidate('graveyard')), line).toBe(true);
      expect(targetAllowed(spec, src, candidate('exile')), line).toBe(false);
    }
  });

  test('the phrases D138 already read are unchanged', () => {
    const raise = cardClause('Return target creature card from your graveyard to your hand.');
    expect([raise.zones, raise.controller, raise.unenforced]).toEqual([['graveyard'], 'you', []]);
    const any = cardClause('Exile target card from a graveyard.');
    expect([any.zones, any.controller, any.unenforced]).toEqual([['graveyard'], 'any', []]);
    const opp = cardClause("Exile target card from an opponent's graveyard.");
    expect([opp.zones, opp.controller, opp.unenforced]).toEqual([['graveyard'], 'opponent', []]);
  });

  test('the card says it: a Rapid Decay (the printed line on a fixture body) names the single graveyard', () => {
    const base = ENGINE_CARDS.find((c) => c.name === 'Raise Dead');
    if (!base) throw new Error('no fixture Raise Dead');
    const text = 'Exile up to three target cards from a single graveyard.';
    const synth: CardData = { ...base, name: 'Rapid Decay (synthetic)', oracleId: 'graveyard-qualifier-synthetic', faces: [{ ...(base.faces[0] as CardData['faces'][number]), name: 'Rapid Decay (synthetic)', oracleText: text }] };
    expect(tier3NotesFor(synth, 0).map((n) => n.what)).toContain('“from a single graveyard” on its target');
  });
});

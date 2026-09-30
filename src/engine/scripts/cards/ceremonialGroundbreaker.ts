// `Ceremonial Groundbreaker` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CEREMONIAL_GROUNDBREAKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CEREMONIAL_GROUNDBREAKER, "Equipped creature gets +2/+1 and has trample.\nEquip Citizen {1}\nEquip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const CEREMONIAL_GROUNDBREAKER_SCRIPT: CardScript = {
  oracleId: CEREMONIAL_GROUNDBREAKER.oracleId,
  name: CEREMONIAL_GROUNDBREAKER.name,
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};

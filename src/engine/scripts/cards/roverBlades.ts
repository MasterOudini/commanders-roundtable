// `Rover Blades` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROVER_BLADES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROVER_BLADES, "Double strike\nEquipped creature has double strike.\nEquip {4}\nCrew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn. Creatures can't be attached to other permanents.)");
const LINES = PRINTED.split('\n');

export const ROVER_BLADES_SCRIPT: CardScript = {
  oracleId: ROVER_BLADES.oracleId,
  name: ROVER_BLADES.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};

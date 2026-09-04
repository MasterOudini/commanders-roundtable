// `Ogre's Cleaver` - an Equipment: the equipped creature gets +5/+0.
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { OGRE_S_CLEAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OGRE_S_CLEAVER, "Equipped creature gets +5/+0.\nEquip {5}");
const LINES = PRINTED.split('\n');

export const OGRES_CLEAVER_SCRIPT: CardScript = {
  oracleId: OGRE_S_CLEAVER.oracleId,
  name: OGRE_S_CLEAVER.name,
  statics: [
    {
      abilityId: 'equipped-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 5;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};

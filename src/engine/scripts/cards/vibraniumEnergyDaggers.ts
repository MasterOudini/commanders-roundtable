// `Vibranium Energy Daggers` - an Equipment: the equipped creature gets +2/+2.
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { VIBRANIUM_ENERGY_DAGGERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIBRANIUM_ENERGY_DAGGERS, "Indestructible (Effects that say \"destroy\" don't destroy this Equipment.)\nEquipped creature gets +2/+2.\nEquip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const VIBRANIUM_ENERGY_DAGGERS_SCRIPT: CardScript = {
  oracleId: VIBRANIUM_ENERGY_DAGGERS.oracleId,
  name: VIBRANIUM_ENERGY_DAGGERS.name,
  statics: [
    {
      abilityId: 'equipped-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};

// `Accorder's Shield` - an Equipment: the equipped creature gets +0/+3 and has vigilance.
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { ACCORDER_S_SHIELD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACCORDER_S_SHIELD, "Equipped creature gets +0/+3 and has vigilance. (Attacking doesn't cause it to tap.)\nEquip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const ACCORDERS_SHIELD_SCRIPT: CardScript = {
  oracleId: ACCORDER_S_SHIELD.oracleId,
  name: ACCORDER_S_SHIELD.name,
  statics: [
    {
      abilityId: 'equipped-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
    {
      abilityId: 'equipped-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};

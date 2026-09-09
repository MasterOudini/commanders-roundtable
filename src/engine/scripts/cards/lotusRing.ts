// `Lotus Ring` - the permanent it is attached to HAS a quoted
// MANA ability (D372's carrier): a layer-6 static pushes the quoted line's production onto
// the recipient's derived `producesMana`. A mana ability never uses the stack (CR 605), so
// there is no def - the offer, the tap and the payment solver read the derived list as they
// read a printed one, and the RECIPIENT taps, pays and makes the mana (CR 113.7a).
// Generated from one table row.

import { LOTUS_RING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedMana, pushGrantedMana } from '../grants';
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

const PRINTED = printed(LOTUS_RING, "Indestructible\nEquipped creature gets +3/+3 and has vigilance and \"{T}, Sacrifice this creature: Add three mana of any one color.\"\nEquip {3}");
const LINES = PRINTED.split('\n');

const GRANT = grantedMana("{T}, Sacrifice this creature: Add three mana of any one color.", LOTUS_RING.name);

export const LOTUS_RING_SCRIPT: CardScript = {
  oracleId: LOTUS_RING.oracleId,
  name: LOTUS_RING.name,
  statics: [
    {
      abilityId: 'grant-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
    {
      abilityId: 'grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("vigilance");
        pushGrantedMana(chars, GRANT);
      },
    },
  ],
};

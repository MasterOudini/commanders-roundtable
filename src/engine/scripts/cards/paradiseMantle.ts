// `Paradise Mantle` - the permanent it is attached to HAS a quoted
// MANA ability (D372's carrier): a layer-6 static pushes the quoted line's production onto
// the recipient's derived `producesMana`. A mana ability never uses the stack (CR 605), so
// there is no def - the offer, the tap and the payment solver read the derived list as they
// read a printed one, and the RECIPIENT taps, pays and makes the mana (CR 113.7a).
// Generated from one table row.

import { PARADISE_MANTLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PARADISE_MANTLE, "Equipped creature has \"{T}: Add one mana of any color.\"\nEquip {1}");
const LINES = PRINTED.split('\n');

const GRANT = grantedMana("{T}: Add one mana of any color.", PARADISE_MANTLE.name);

export const PARADISE_MANTLE_SCRIPT: CardScript = {
  oracleId: PARADISE_MANTLE.oracleId,
  name: PARADISE_MANTLE.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        pushGrantedMana(chars, GRANT);
      },
    },
  ],
};

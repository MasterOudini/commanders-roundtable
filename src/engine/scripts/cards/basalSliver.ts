// `Basal Sliver` - every permanent in its scope HAS a quoted
// MANA ability (D372's carrier): a layer-6 static pushes the quoted line's production onto
// the recipient's derived `producesMana`. A mana ability never uses the stack (CR 605), so
// there is no def - the offer, the tap and the payment solver read the derived list as they
// read a printed one, and the RECIPIENT taps, pays and makes the mana (CR 113.7a).
// Generated from one table row.

import { BASAL_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BASAL_SLIVER, "All Slivers have \"Sacrifice this permanent: Add {B}{B}.\"");

const GRANT = grantedMana("Sacrifice this permanent: Add {B}{B}.", BASAL_SLIVER.name);

export const BASAL_SLIVER_SCRIPT: CardScript = {
  oracleId: BASAL_SLIVER.oracleId,
  name: BASAL_SLIVER.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, _self, _candidate, chars) => chars.typeLine.subtypes.includes("Sliver"),
      modify: (chars) => {
        pushGrantedMana(chars, GRANT);
      },
    },
  ],
};

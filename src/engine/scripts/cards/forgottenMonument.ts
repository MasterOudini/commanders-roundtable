// `Forgotten Monument` - every permanent in its scope HAS a quoted
// MANA ability (D372's carrier): a layer-6 static pushes the quoted line's production onto
// the recipient's derived `producesMana`. A mana ability never uses the stack (CR 605), so
// there is no def - the offer, the tap and the payment solver read the derived list as they
// read a printed one, and the RECIPIENT taps, pays and makes the mana (CR 113.7a).
// Generated from one table row.

import { FORGOTTEN_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORGOTTEN_MONUMENT, "{T}: Add {C}.\nOther Caves you control have \"{T}, Pay 1 life: Add one mana of any color.\"");
const LINES = PRINTED.split('\n');

const GRANT = grantedMana("{T}, Pay 1 life: Add one mana of any color.", FORGOTTEN_MONUMENT.name);

export const FORGOTTEN_MONUMENT_SCRIPT: CardScript = {
  oracleId: FORGOTTEN_MONUMENT.oracleId,
  name: FORGOTTEN_MONUMENT.name,
  statics: [
    {
      abilityId: 'grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.subtypes.includes("Cave") && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars) => {
        pushGrantedMana(chars, GRANT);
      },
    },
  ],
};

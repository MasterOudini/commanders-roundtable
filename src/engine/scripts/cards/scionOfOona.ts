// `Scion of Oona` - a static anthem, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCION_OF_OONA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCION_OF_OONA, "Flash\nFlying\nOther Faerie creatures you control get +1/+1.\nOther Faeries you control have shroud. (They can't be the targets of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const SCION_OF_OONA_SCRIPT: CardScript = {
  oracleId: SCION_OF_OONA.oracleId,
  name: SCION_OF_OONA.name,
  statics: [
    {
      abilityId: 'anthem-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Faerie") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'anthem-grant-3',
      text: LINES[3] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Faerie") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};

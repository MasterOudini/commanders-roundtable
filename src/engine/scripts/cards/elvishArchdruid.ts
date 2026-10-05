// `Elvish Archdruid` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELVISH_ARCHDRUID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELVISH_ARCHDRUID, "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.");
const LINES = PRINTED.split('\n');

export const ELVISH_ARCHDRUID_SCRIPT: CardScript = {
  oracleId: ELVISH_ARCHDRUID.oracleId,
  name: ELVISH_ARCHDRUID.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Elf") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};

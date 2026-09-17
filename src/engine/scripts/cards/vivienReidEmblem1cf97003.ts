// `Vivien Reid Emblem` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIVIEN_REID_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIVIEN_REID_EMBLEM, "Creatures you control get +2/+2 and have vigilance, trample, and indestructible.");

export const VIVIEN_REID_EMBLEM1CF97003_SCRIPT: CardScript = {
  oracleId: VIVIEN_REID_EMBLEM.oracleId,
  name: VIVIEN_REID_EMBLEM.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("vigilance");
        chars.keywords.add("trample");
        chars.keywords.add("indestructible");
      },
    },
  ],
};

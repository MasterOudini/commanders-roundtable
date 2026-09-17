// `Garruk, Cursed Huntsman Emblem` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GARRUK_CURSED_HUNTSMAN_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GARRUK_CURSED_HUNTSMAN_EMBLEM, "Creatures you control get +3/+3 and have trample.");

export const GARRUK_CURSED_HUNTSMAN_EMBLEMD6C65749_SCRIPT: CardScript = {
  oracleId: GARRUK_CURSED_HUNTSMAN_EMBLEM.oracleId,
  name: GARRUK_CURSED_HUNTSMAN_EMBLEM.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};

// `Lyra Dawnbringer` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LYRA_DAWNBRINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LYRA_DAWNBRINGER, "Flying\nFirst strike (This creature deals combat damage before creatures without first strike.)\nLifelink (Damage dealt by this creature also causes you to gain that much life.)\nOther Angels you control get +1/+1 and have lifelink.");
const LINES = PRINTED.split('\n');

export const LYRA_DAWNBRINGER_SCRIPT: CardScript = {
  oracleId: LYRA_DAWNBRINGER.oracleId,
  name: LYRA_DAWNBRINGER.name,
  statics: [
    {
      abilityId: 'anthem-pt-3',
      text: LINES[3] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Angel") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
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
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Angel") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("lifelink");
      },
    },
  ],
};

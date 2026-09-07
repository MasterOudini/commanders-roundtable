// `Boldwyr Aggressor` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOLDWYR_AGGRESSOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOLDWYR_AGGRESSOR, "Double strike\nOther Giants you control have double strike.");
const LINES = PRINTED.split('\n');

export const BOLDWYR_AGGRESSOR_SCRIPT: CardScript = {
  oracleId: BOLDWYR_AGGRESSOR.oracleId,
  name: BOLDWYR_AGGRESSOR.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Giant") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};

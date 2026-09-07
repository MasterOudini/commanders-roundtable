// `Berserkers' Onslaught` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BERSERKERS_ONSLAUGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BERSERKERS_ONSLAUGHT, "Attacking creatures you control have double strike.");

export const BERSERKERS_ONSLAUGHT_SCRIPT: CardScript = {
  oracleId: BERSERKERS_ONSLAUGHT.oracleId,
  name: BERSERKERS_ONSLAUGHT.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.combat?.attackers.some((x) => x.card === candidate) ?? false) && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};

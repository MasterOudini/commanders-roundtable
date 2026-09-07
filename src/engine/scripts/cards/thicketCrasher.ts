// `Thicket Crasher` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THICKET_CRASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THICKET_CRASHER, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nOther Elementals you control have trample.");
const LINES = PRINTED.split('\n');

export const THICKET_CRASHER_SCRIPT: CardScript = {
  oracleId: THICKET_CRASHER.oracleId,
  name: THICKET_CRASHER.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Elemental") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};

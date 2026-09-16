// `Angel of Invention` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANGEL_OF_INVENTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANGEL_OF_INVENTION, "Flying, vigilance, lifelink\nFabricate 2 (When this creature enters, put two +1/+1 counters on it or create two 1/1 colorless Servo artifact creature tokens.)\nOther creatures you control get +1/+1.");
const LINES = PRINTED.split('\n');

export const ANGEL_OF_INVENTION_SCRIPT: CardScript = {
  oracleId: ANGEL_OF_INVENTION.oracleId,
  name: ANGEL_OF_INVENTION.name,
  statics: [
    {
      abilityId: 'anthem-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};

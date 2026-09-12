// `Heartless Summoning` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEARTLESS_SUMMONING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEARTLESS_SUMMONING, "Creature spells you cast cost {2} less to cast.\nCreatures you control get -1/-1.");
const LINES = PRINTED.split('\n');

export const HEARTLESS_SUMMONING_SCRIPT: CardScript = {
  oracleId: HEARTLESS_SUMMONING.oracleId,
  name: HEARTLESS_SUMMONING.name,
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += -1;
        if (chars.toughness !== null) chars.toughness += -1;
      },
    },
  ],
};

// `Force of Virtue` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORCE_OF_VIRTUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORCE_OF_VIRTUE, "If it's not your turn, you may exile a white card from your hand rather than pay this spell's mana cost.\nFlash\nCreatures you control get +1/+1.");
const LINES = PRINTED.split('\n');

export const FORCE_OF_VIRTUE_SCRIPT: CardScript = {
  oracleId: FORCE_OF_VIRTUE.oracleId,
  name: FORCE_OF_VIRTUE.name,
  statics: [
    {
      abilityId: 'anthem-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};

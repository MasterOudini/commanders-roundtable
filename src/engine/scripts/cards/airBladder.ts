// `Air Bladder` - a static attachedStatic, a static attachedCombat
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AIR_BLADDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AIR_BLADDER, "Enchant creature\nEnchanted creature has flying.\nEnchanted creature can block only creatures with flying.");
const LINES = PRINTED.split('\n');

export const AIR_BLADDER_SCRIPT: CardScript = {
  oracleId: AIR_BLADDER.oracleId,
  name: AIR_BLADDER.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
  combat: [
    {
      abilityId: 'attached-combat-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== ctx.state.cards[self]?.attachedTo || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};

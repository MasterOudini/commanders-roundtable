// `Xenograft` - a static typeAdd
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { XENOGRAFT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(XENOGRAFT, "As this enchantment enters, choose a creature type.\nEach creature you control is the chosen type in addition to its other types.");
const LINES = PRINTED.split('\n');

export const XENOGRAFT_SCRIPT: CardScript = {
  oracleId: XENOGRAFT.oracleId,
  name: XENOGRAFT.name,
  statics: [
    {
      abilityId: 'type-add-1',
      text: LINES[1] as string,
      layer: 'type',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && ctx.state.cards[self]?.chosenType !== null,
      modify: (chars, ctx, self) => {
        const t = ctx.state.cards[self]?.chosenType;
        if (t && !chars.typeLine.subtypes.includes(t)) chars.typeLine = { ...chars.typeLine, subtypes: [...chars.typeLine.subtypes, t] };
      },
    },
  ],
};

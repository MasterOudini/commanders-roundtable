// `Ghostly Wings` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOSTLY_WINGS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(GHOSTLY_WINGS, "Enchant creature\nEnchanted creature gets +1/+1 and has flying.\nDiscard a card: Return enchanted creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return enchanted creature to its owner's hand.", GHOSTLY_WINGS.name);
const VOCAB_T_A0 = vocabularyTargets("Return enchanted creature to its owner's hand.");

export const GHOSTLY_WINGS_SCRIPT: CardScript = {
  oracleId: GHOSTLY_WINGS.oracleId,
  name: GHOSTLY_WINGS.name,
  activated: [
    {
      ref: `${GHOSTLY_WINGS.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
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
};

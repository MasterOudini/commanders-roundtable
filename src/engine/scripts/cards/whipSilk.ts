// `Whip Silk` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHIP_SILK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHIP_SILK, "Enchant creature\nEnchanted creature has reach. (It can block creatures with flying.)\n{G}: Return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return this Aura to its owner's hand.", WHIP_SILK.name);
const VOCAB_T_A0 = vocabularyTargets("Return this Aura to its owner's hand.");

export const WHIP_SILK_SCRIPT: CardScript = {
  oracleId: WHIP_SILK.oracleId,
  name: WHIP_SILK.name,
  activated: [
    {
      ref: `${WHIP_SILK.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("reach");
      },
    },
  ],
};

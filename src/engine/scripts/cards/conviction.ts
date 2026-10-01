// `Conviction` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONVICTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONVICTION, "Enchant creature\nEnchanted creature gets +1/+3.\n{W}: Return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return this Aura to its owner's hand.", CONVICTION.name);
const VOCAB_T_A0 = vocabularyTargets("Return this Aura to its owner's hand.");

export const CONVICTION_SCRIPT: CardScript = {
  oracleId: CONVICTION.oracleId,
  name: CONVICTION.name,
  activated: [
    {
      ref: `${CONVICTION.oracleId}#a0`,
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
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
  ],
};

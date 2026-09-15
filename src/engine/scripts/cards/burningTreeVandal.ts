// `Burning-Tree Vandal` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURNING_TREE_VANDAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURNING_TREE_VANDAL, "Riot (This creature enters with your choice of a +1/+1 counter or haste.)\nWhenever this creature attacks, you may discard a card. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may discard a card. If you do, draw a card.", BURNING_TREE_VANDAL.name);
const VOCAB_T_L1 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const BURNING_TREE_VANDAL_SCRIPT: CardScript = {
  oracleId: BURNING_TREE_VANDAL.oracleId,
  name: BURNING_TREE_VANDAL.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Burning-Tree Vandal - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

// `Steel Leaf Paladin` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEEL_LEAF_PALADIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEEL_LEAF_PALADIN, "First strike\nWhen this creature enters, return a green or white creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return a green or white creature you control to its owner's hand.", STEEL_LEAF_PALADIN.name);
const VOCAB_T_L1 = vocabularyTargets("Return a green or white creature you control to its owner's hand.");

export const STEEL_LEAF_PALADIN_SCRIPT: CardScript = {
  oracleId: STEEL_LEAF_PALADIN.oracleId,
  name: STEEL_LEAF_PALADIN.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Steel Leaf Paladin - Return a green or white creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

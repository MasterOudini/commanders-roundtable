// `Creakwood Ghoul` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CREAKWOOD_GHOUL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CREAKWOOD_GHOUL, "{B/G}{B/G}: Exile target card from a graveyard. You gain 1 life.");

const VOCAB_A0 = vocabularyEffects("Exile target card from a graveyard. You gain 1 life.", CREAKWOOD_GHOUL.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target card from a graveyard. You gain 1 life.");

export const CREAKWOOD_GHOUL_SCRIPT: CardScript = {
  oracleId: CREAKWOOD_GHOUL.oracleId,
  name: CREAKWOOD_GHOUL.name,
  activated: [
    {
      ref: `${CREAKWOOD_GHOUL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};

// `Otepec Huntmaster` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OTEPEC_HUNTMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OTEPEC_HUNTMASTER, "Dinosaur spells you cast cost {1} less to cast.\n{T}: Target Dinosaur gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Dinosaur gains haste until end of turn.", OTEPEC_HUNTMASTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target Dinosaur gains haste until end of turn.");

export const OTEPEC_HUNTMASTER_SCRIPT: CardScript = {
  oracleId: OTEPEC_HUNTMASTER.oracleId,
  name: OTEPEC_HUNTMASTER.name,
  activated: [
    {
      ref: `${OTEPEC_HUNTMASTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};

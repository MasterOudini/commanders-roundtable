// `Jiwari, the Earth Aflame` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JIWARI_THE_EARTH_AFLAME } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JIWARI_THE_EARTH_AFLAME, "{X}{R}, {T}: Jiwari deals X damage to target creature without flying.\nChannel — {X}{R}{R}{R}, Discard this card: It deals X damage to each creature without flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals X damage to target creature without flying.", JIWARI_THE_EARTH_AFLAME.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("~ deals X damage to target creature without flying.");
const VOCAB_A1 = vocabularyEffects("It deals X damage to each creature without flying.", JIWARI_THE_EARTH_AFLAME.name, { xCost: true });
const VOCAB_T_A1 = vocabularyTargets("It deals X damage to each creature without flying.");

export const JIWARI_THE_EARTH_AFLAME_SCRIPT: CardScript = {
  oracleId: JIWARI_THE_EARTH_AFLAME.oracleId,
  name: JIWARI_THE_EARTH_AFLAME.name,
  activated: [
    {
      ref: `${JIWARI_THE_EARTH_AFLAME.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${JIWARI_THE_EARTH_AFLAME.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};

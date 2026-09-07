// `Wall of Distortion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALL_OF_DISTORTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALL_OF_DISTORTION, "Defender (This creature can't attack.)\n{2}{B}, {T}: Target player discards a card. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player discards a card.", WALL_OF_DISTORTION.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards a card.");

export const WALL_OF_DISTORTION_SCRIPT: CardScript = {
  oracleId: WALL_OF_DISTORTION.oracleId,
  name: WALL_OF_DISTORTION.name,
  activated: [
    {
      ref: `${WALL_OF_DISTORTION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};

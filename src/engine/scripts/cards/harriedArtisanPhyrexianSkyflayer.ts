// `Harried Artisan // Phyrexian Skyflayer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER, "Haste\n{3}{W/P}: Transform this creature. Activate only as a sorcery. ({W/P} can be paid with either {W} or 2 life.)\nFlying, haste");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER_SCRIPT: CardScript = {
  oracleId: HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER.oracleId,
  name: HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER.name,
  activated: [
    {
      ref: `${HARRIED_ARTISAN_PHYREXIAN_SKYFLAYER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};

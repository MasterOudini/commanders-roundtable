// `Obsessive Stitcher` - an activation loot, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OBSESSIVE_STITCHER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(OBSESSIVE_STITCHER, "{T}: Draw a card, then discard a card.\n{2}{U}{B}, {T}, Sacrifice this creature: Return target creature card from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Return target creature card from your graveyard to the battlefield.", OBSESSIVE_STITCHER.name);
const VOCAB_T_A1 = vocabularyTargets("Return target creature card from your graveyard to the battlefield.");

export const OBSESSIVE_STITCHER_SCRIPT: CardScript = {
  oracleId: OBSESSIVE_STITCHER.oracleId,
  name: OBSESSIVE_STITCHER.name,
  activated: [
    {
      ref: `${OBSESSIVE_STITCHER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Obsessive Stitcher - discard a card" } },
        ];
      },
    },
    {
      ref: `${OBSESSIVE_STITCHER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};

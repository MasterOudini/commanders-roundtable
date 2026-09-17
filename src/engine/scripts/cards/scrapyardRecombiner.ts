// `Scrapyard Recombiner` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCRAPYARD_RECOMBINER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCRAPYARD_RECOMBINER, "Modular 2 (This creature enters with two +1/+1 counters on it. When it dies, you may put its +1/+1 counters on target artifact creature.)\n{T}, Sacrifice an artifact: Search your library for a Construct card, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a Construct card, reveal it, put it into your hand, then shuffle.", SCRAPYARD_RECOMBINER.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Construct card, reveal it, put it into your hand, then shuffle.");

export const SCRAPYARD_RECOMBINER_SCRIPT: CardScript = {
  oracleId: SCRAPYARD_RECOMBINER.oracleId,
  name: SCRAPYARD_RECOMBINER.name,
  activated: [
    {
      ref: `${SCRAPYARD_RECOMBINER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};

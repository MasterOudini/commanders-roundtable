// `Culling Dais` - an activation selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CULLING_DAIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CULLING_DAIS, "{T}, Sacrifice a creature: Put a charge counter on this artifact.\n{1}, Sacrifice this artifact: Draw a card for each charge counter on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Draw a card for each charge counter on ~.", CULLING_DAIS.name);
const VOCAB_T_A1 = vocabularyTargets("Draw a card for each charge counter on ~.");

export const CULLING_DAIS_SCRIPT: CardScript = {
  oracleId: CULLING_DAIS.oracleId,
  name: CULLING_DAIS.name,
  activated: [
    {
      ref: `${CULLING_DAIS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 1 }] }];
      },
    },
    {
      ref: `${CULLING_DAIS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};

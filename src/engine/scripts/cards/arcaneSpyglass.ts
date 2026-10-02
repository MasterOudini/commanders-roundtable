// `Arcane Spyglass` - an activation vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCANE_SPYGLASS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCANE_SPYGLASS, "{2}, {T}, Sacrifice a land: Draw a card and put a charge counter on this artifact.\nRemove three charge counters from this artifact: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Draw a card and put a charge counter on ~.", ARCANE_SPYGLASS.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card and put a charge counter on ~.");

export const ARCANE_SPYGLASS_SCRIPT: CardScript = {
  oracleId: ARCANE_SPYGLASS.oracleId,
  name: ARCANE_SPYGLASS.name,
  activated: [
    {
      ref: `${ARCANE_SPYGLASS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ARCANE_SPYGLASS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};

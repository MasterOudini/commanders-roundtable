// `Jace, Ingenious Mind-Mage` - an activation draw, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JACE_INGENIOUS_MIND_MAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JACE_INGENIOUS_MIND_MAGE, "+1: Draw a card.\n+1: Untap all creatures you control.\n−9: Gain control of up to three target creatures.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Untap all creatures you control.", JACE_INGENIOUS_MIND_MAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Untap all creatures you control.");
const VOCAB_A2 = vocabularyEffects("Gain control of up to three target creatures.", JACE_INGENIOUS_MIND_MAGE.name);
const VOCAB_T_A2 = vocabularyTargets("Gain control of up to three target creatures.");

export const JACE_INGENIOUS_MIND_MAGE_SCRIPT: CardScript = {
  oracleId: JACE_INGENIOUS_MIND_MAGE.oracleId,
  name: JACE_INGENIOUS_MIND_MAGE.name,
  activated: [
    {
      ref: `${JACE_INGENIOUS_MIND_MAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${JACE_INGENIOUS_MIND_MAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${JACE_INGENIOUS_MIND_MAGE.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};

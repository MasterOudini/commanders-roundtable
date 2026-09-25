// `Splitting Slime` - an activation vocab, a becomesMonstrous trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPLITTING_SLIME } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPLITTING_SLIME, "{4}{G}{G}: Monstrosity 3. (If this creature isn't monstrous, put three +1/+1 counters on it and it becomes monstrous.)\nWhen this creature becomes monstrous, create a token that's a copy of this creature. (The token has no counters and isn't monstrous.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Monstrosity 3.", SPLITTING_SLIME.name);
const VOCAB_T_A0 = vocabularyTargets("Monstrosity 3.");
const VOCAB_L1 = vocabularyEffects("Create a token that's a copy of this creature.", SPLITTING_SLIME.name);
const VOCAB_T_L1 = vocabularyTargets("Create a token that's a copy of this creature.");

export const SPLITTING_SLIME_SCRIPT: CardScript = {
  oracleId: SPLITTING_SLIME.oracleId,
  name: SPLITTING_SLIME.name,
  activated: [
    {
      ref: `${SPLITTING_SLIME.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesMonstrous-1',
      text: LINES[1] as string,
      event: 'BecameMonstrous',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BecameMonstrous' && ev.card === self,
      label: () => "Splitting Slime - Create a token that's a copy of this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

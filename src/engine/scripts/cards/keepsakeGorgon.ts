// `Keepsake Gorgon` - an activation vocab, a becomesMonstrous trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KEEPSAKE_GORGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KEEPSAKE_GORGON, "Deathtouch\n{5}{B}{B}: Monstrosity 1. (If this creature isn't monstrous, put a +1/+1 counter on it and it becomes monstrous.)\nWhen this creature becomes monstrous, destroy target non-Gorgon creature an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Monstrosity 1.", KEEPSAKE_GORGON.name);
const VOCAB_T_A0 = vocabularyTargets("Monstrosity 1.");
const VOCAB_L2 = vocabularyEffects("Destroy target non-Gorgon creature an opponent controls.", KEEPSAKE_GORGON.name);
const VOCAB_T_L2 = vocabularyTargets("Destroy target non-Gorgon creature an opponent controls.");

export const KEEPSAKE_GORGON_SCRIPT: CardScript = {
  oracleId: KEEPSAKE_GORGON.oracleId,
  name: KEEPSAKE_GORGON.name,
  activated: [
    {
      ref: `${KEEPSAKE_GORGON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesMonstrous-2',
      text: LINES[2] as string,
      event: 'BecameMonstrous',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'BecameMonstrous' && ev.card === self,
      label: () => "Keepsake Gorgon - Destroy target non-Gorgon creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

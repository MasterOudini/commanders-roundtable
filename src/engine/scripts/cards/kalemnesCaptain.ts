// `Kalemne's Captain` - an activation vocab, a becomesMonstrous trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KALEMNE_S_CAPTAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KALEMNE_S_CAPTAIN, "Vigilance\n{5}{W}{W}: Monstrosity 3. (If this creature isn't monstrous, put three +1/+1 counters on it and it becomes monstrous.)\nWhen this creature becomes monstrous, exile all artifacts and enchantments.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Monstrosity 3.", KALEMNE_S_CAPTAIN.name);
const VOCAB_T_A0 = vocabularyTargets("Monstrosity 3.");
const VOCAB_L2 = vocabularyEffects("Exile all artifacts and enchantments.", KALEMNE_S_CAPTAIN.name);
const VOCAB_T_L2 = vocabularyTargets("Exile all artifacts and enchantments.");

export const KALEMNES_CAPTAIN_SCRIPT: CardScript = {
  oracleId: KALEMNE_S_CAPTAIN.oracleId,
  name: KALEMNE_S_CAPTAIN.name,
  activated: [
    {
      ref: `${KALEMNE_S_CAPTAIN.oracleId}#a0`,
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
      matches: (_ctx, self, ev) => ev.t === 'BecameMonstrous' && ev.card === self,
      label: () => "Kalemne's Captain - Exile all artifacts and enchantments.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

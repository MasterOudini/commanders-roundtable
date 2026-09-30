// `Lashweed Lurker` - a castThisSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LASHWEED_LURKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LASHWEED_LURKER, "Emerge {5}{G}{U} (You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value.)\nWhen you cast this spell, you may put target nonland permanent on top of its owner's library.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put target nonland permanent on top of its owner's library.", LASHWEED_LURKER.name);
const VOCAB_T_L1 = vocabularyTargets("Put target nonland permanent on top of its owner's library.");

export const LASHWEED_LURKER_SCRIPT: CardScript = {
  oracleId: LASHWEED_LURKER.oracleId,
  name: LASHWEED_LURKER.name,
  triggers: [
    {
      abilityId: 'castThisSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Lashweed Lurker - Put target nonland permanent on top of its owner's library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

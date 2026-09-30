// `Elder Deep-Fiend` - a castThisSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELDER_DEEP_FIEND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELDER_DEEP_FIEND, "Flash\nEmerge {5}{U}{U} (You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value.)\nWhen you cast this spell, tap up to four target permanents.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Tap up to four target permanents.", ELDER_DEEP_FIEND.name);
const VOCAB_T_L2 = vocabularyTargets("Tap up to four target permanents.");

export const ELDER_DEEP_FIEND_SCRIPT: CardScript = {
  oracleId: ELDER_DEEP_FIEND.oracleId,
  name: ELDER_DEEP_FIEND.name,
  triggers: [
    {
      abilityId: 'castThisSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Elder Deep-Fiend - Tap up to four target permanents.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

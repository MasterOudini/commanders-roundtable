// `Vexing Scuttler` - a castThisSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VEXING_SCUTTLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VEXING_SCUTTLER, "Emerge {6}{U} (You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value.)\nWhen you cast this spell, you may return target instant or sorcery card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target instant or sorcery card from your graveyard to your hand.", VEXING_SCUTTLER.name);
const VOCAB_T_L1 = vocabularyTargets("Return target instant or sorcery card from your graveyard to your hand.");

export const VEXING_SCUTTLER_SCRIPT: CardScript = {
  oracleId: VEXING_SCUTTLER.oracleId,
  name: VEXING_SCUTTLER.name,
  triggers: [
    {
      abilityId: 'castThisSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Vexing Scuttler - Return target instant or sorcery card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

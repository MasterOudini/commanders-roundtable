// `Took Reaper` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOOK_REAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOOK_REAPER, "When this creature dies, the Ring tempts you.");

const VOCAB_L0 = vocabularyEffects("The Ring tempts you.", TOOK_REAPER.name);
const VOCAB_T_L0 = vocabularyTargets("The Ring tempts you.");

export const TOOK_REAPER_SCRIPT: CardScript = {
  oracleId: TOOK_REAPER.oracleId,
  name: TOOK_REAPER.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Took Reaper - The Ring tempts you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

// `Sultai Emissary` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SULTAI_EMISSARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SULTAI_EMISSARY, "When this creature dies, manifest the top card of your library. (Put that card onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it's a creature card.)");

const VOCAB_L0 = vocabularyEffects("Manifest the top card of your library.", SULTAI_EMISSARY.name);
const VOCAB_T_L0 = vocabularyTargets("Manifest the top card of your library.");

export const SULTAI_EMISSARY_SCRIPT: CardScript = {
  oracleId: SULTAI_EMISSARY.oracleId,
  name: SULTAI_EMISSARY.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Sultai Emissary - Manifest the top card of your library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

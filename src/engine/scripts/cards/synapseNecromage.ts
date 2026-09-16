// `Synapse Necromage` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SYNAPSE_NECROMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SYNAPSE_NECROMAGE, "When this creature dies, create two 1/1 black Fungus creature tokens with \"This token can't block.\"");

const VOCAB_L0 = vocabularyEffects("Create two 1/1 black Fungus creature tokens with \"This token can't block.\"", SYNAPSE_NECROMAGE.name);
const VOCAB_T_L0 = vocabularyTargets("Create two 1/1 black Fungus creature tokens with \"This token can't block.\"");

export const SYNAPSE_NECROMAGE_SCRIPT: CardScript = {
  oracleId: SYNAPSE_NECROMAGE.oracleId,
  name: SYNAPSE_NECROMAGE.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Synapse Necromage - Create two 1/1 black Fungus creature tokens with \"This token can't block.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

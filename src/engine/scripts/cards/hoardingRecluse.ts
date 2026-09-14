// `Hoarding Recluse` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOARDING_RECLUSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOARDING_RECLUSE, "Reach, deathtouch\nWhen this creature dies, put up to one other target card from a graveyard on the bottom of its owner's library.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put up to one other target card from a graveyard on the bottom of its owner's library.", HOARDING_RECLUSE.name);
const VOCAB_T_L1 = vocabularyTargets("Put up to one other target card from a graveyard on the bottom of its owner's library.");

export const HOARDING_RECLUSE_SCRIPT: CardScript = {
  oracleId: HOARDING_RECLUSE.oracleId,
  name: HOARDING_RECLUSE.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Hoarding Recluse - Put up to one other target card from a graveyard on the bottom of its owner's library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

// `Phyrexian War Beast` - a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_WAR_BEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_WAR_BEAST, "When this creature leaves the battlefield, sacrifice a land and this creature deals 1 damage to you.");

const VOCAB_L0 = vocabularyEffects("Sacrifice a land and this creature deals 1 damage to you.", PHYREXIAN_WAR_BEAST.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice a land and this creature deals 1 damage to you.");

export const PHYREXIAN_WAR_BEAST_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_WAR_BEAST.oracleId,
  name: PHYREXIAN_WAR_BEAST.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Phyrexian War Beast - Sacrifice a land and this creature deals 1 damage to you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

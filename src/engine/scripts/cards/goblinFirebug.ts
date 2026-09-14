// `Goblin Firebug` - a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_FIREBUG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_FIREBUG, "When this creature leaves the battlefield, sacrifice a land.");

const VOCAB_L0 = vocabularyEffects("Sacrifice a land.", GOBLIN_FIREBUG.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice a land.");

export const GOBLIN_FIREBUG_SCRIPT: CardScript = {
  oracleId: GOBLIN_FIREBUG.oracleId,
  name: GOBLIN_FIREBUG.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Goblin Firebug - Sacrifice a land.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

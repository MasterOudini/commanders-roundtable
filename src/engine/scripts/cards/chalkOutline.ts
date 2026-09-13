// `Chalk Outline` - a cardLeavesYourGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHALK_OUTLINE } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const PRINTED = printed(CHALK_OUTLINE, "Whenever one or more creature cards leave your graveyard, create a 2/2 white and blue Detective creature token, then investigate. (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")");

const VOCAB_L0 = vocabularyEffects("Create a 2/2 white and blue Detective creature token, then investigate.", CHALK_OUTLINE.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 2/2 white and blue Detective creature token, then investigate.");

export const CHALK_OUTLINE_SCRIPT: CardScript = {
  oracleId: CHALK_OUTLINE.oracleId,
  name: CHALK_OUTLINE.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'graveyard') return false;
          if (m.from.player !== ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
          if (!oc) return false;
          const f = faceOf(oc, inst?.faceIndex ?? 0);
          return f.typeLine.types.includes('Creature');
        }),
      label: () => "Chalk Outline - Create a 2/2 white and blue Detective creature token, then investigate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

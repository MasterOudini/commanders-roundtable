// `Grovetender Druids` - a selfOrAnotherAllyEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GROVETENDER_DRUIDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GROVETENDER_DRUIDS, "Rally — Whenever this creature or another Ally you control enters, you may pay {1}. If you do, create a 1/1 green Plant creature token.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, create a 1/1 green Plant creature token.", GROVETENDER_DRUIDS.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, create a 1/1 green Plant creature token.");

export const GROVETENDER_DRUIDS_SCRIPT: CardScript = {
  oracleId: GROVETENDER_DRUIDS.oracleId,
  name: GROVETENDER_DRUIDS.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherAllyEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.subtypes.includes('Ally')),
        ),
      label: () => "Grovetender Druids - You may pay {1}. If you do, create a 1/1 green Plant creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

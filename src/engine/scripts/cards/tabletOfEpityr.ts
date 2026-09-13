// `Tablet of Epityr` - a cardPutIntoGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TABLET_OF_EPITYR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TABLET_OF_EPITYR, "Whenever an artifact you control is put into a graveyard from the battlefield, you may pay {1}. If you do, you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, you gain 1 life.", TABLET_OF_EPITYR.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, you gain 1 life.");

export const TABLET_OF_EPITYR_SCRIPT: CardScript = {
  oracleId: TABLET_OF_EPITYR.oracleId,
  name: TABLET_OF_EPITYR.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Tablet of Epityr - You may pay {1}. If you do, you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

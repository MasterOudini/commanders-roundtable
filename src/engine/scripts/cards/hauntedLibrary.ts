// `Haunted Library` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAUNTED_LIBRARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAUNTED_LIBRARY, "Whenever a creature an opponent controls dies, you may pay {1}. If you do, create a 1/1 white Spirit creature token with flying.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, create a 1/1 white Spirit creature token with flying.", HAUNTED_LIBRARY.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, create a 1/1 white Spirit creature token with flying.");

export const HAUNTED_LIBRARY_SCRIPT: CardScript = {
  oracleId: HAUNTED_LIBRARY.oracleId,
  name: HAUNTED_LIBRARY.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Haunted Library - You may pay {1}. If you do, create a 1/1 white Spirit creature token with flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

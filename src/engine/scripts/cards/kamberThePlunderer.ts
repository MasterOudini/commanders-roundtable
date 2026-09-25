// `Kamber, the Plunderer` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAMBER_THE_PLUNDERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAMBER_THE_PLUNDERER, "Partner with Laurine, the Diversion (When this creature enters, target player may put Laurine into their hand from their library, then shuffle.)\nLifelink\nWhenever a creature an opponent controls dies, you gain 1 life and create a Blood token. (It's an artifact with \"{1}, {T}, Discard a card, Sacrifice this token: Draw a card.\")");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You gain 1 life and create a Blood token.", KAMBER_THE_PLUNDERER.name);
const VOCAB_T_L2 = vocabularyTargets("You gain 1 life and create a Blood token.");

export const KAMBER_THE_PLUNDERER_SCRIPT: CardScript = {
  oracleId: KAMBER_THE_PLUNDERER.oracleId,
  name: KAMBER_THE_PLUNDERER.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Kamber, the Plunderer - You gain 1 life and create a Blood token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

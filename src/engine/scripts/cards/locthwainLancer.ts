// `Locthwain Lancer` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOCTHWAIN_LANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOCTHWAIN_LANCER, "Menace\nWhenever a nontoken Knight you control dies, each opponent loses 1 life and you draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent loses 1 life and you draw a card.", LOCTHWAIN_LANCER.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent loses 1 life and you draw a card.");

export const LOCTHWAIN_LANCER_SCRIPT: CardScript = {
  oracleId: LOCTHWAIN_LANCER.oracleId,
  name: LOCTHWAIN_LANCER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Knight') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Locthwain Lancer - Each opponent loses 1 life and you draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

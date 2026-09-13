// `Tatyova, Benthic Druid` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TATYOVA_BENTHIC_DRUID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TATYOVA_BENTHIC_DRUID, "Landfall — Whenever a land you control enters, you gain 1 life and draw a card.");

const VOCAB_L0 = vocabularyEffects("You gain 1 life and draw a card.", TATYOVA_BENTHIC_DRUID.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 1 life and draw a card.");

export const TATYOVA_BENTHIC_DRUID_SCRIPT: CardScript = {
  oracleId: TATYOVA_BENTHIC_DRUID.oracleId,
  name: TATYOVA_BENTHIC_DRUID.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Tatyova, Benthic Druid - You gain 1 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

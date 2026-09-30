// `Trelasarra, Moon Dancer` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRELASARRA_MOON_DANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRELASARRA_MOON_DANCER, "Whenever you gain life, put a +1/+1 counter on Trelasarra and scry 1. (Look at the top card of your library. You may put that card on the bottom.)");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on ~ and scry 1.", TRELASARRA_MOON_DANCER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on ~ and scry 1.");

export const TRELASARRA_MOON_DANCER_SCRIPT: CardScript = {
  oracleId: TRELASARRA_MOON_DANCER.oracleId,
  name: TRELASARRA_MOON_DANCER.name,
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Trelasarra, Moon Dancer - Put a +1/+1 counter on ~ and scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

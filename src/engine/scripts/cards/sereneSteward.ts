// `Serene Steward` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERENE_STEWARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERENE_STEWARD, "Whenever you gain life, you may pay {W}. If you do, put a +1/+1 counter on target creature.");

const VOCAB_L0 = vocabularyEffects("You may pay {W}. If you do, put a +1/+1 counter on target creature.", SERENE_STEWARD.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {W}. If you do, put a +1/+1 counter on target creature.");

export const SERENE_STEWARD_SCRIPT: CardScript = {
  oracleId: SERENE_STEWARD.oracleId,
  name: SERENE_STEWARD.name,
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Serene Steward - You may pay {W}. If you do, put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

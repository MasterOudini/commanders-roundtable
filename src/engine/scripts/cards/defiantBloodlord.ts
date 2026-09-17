// `Defiant Bloodlord` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEFIANT_BLOODLORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEFIANT_BLOODLORD, "Flying\nWhenever you gain life, target opponent loses that much life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent loses that much life.", DEFIANT_BLOODLORD.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Target opponent loses that much life.");

export const DEFIANT_BLOODLORD_SCRIPT: CardScript = {
  oracleId: DEFIANT_BLOODLORD.oracleId,
  name: DEFIANT_BLOODLORD.name,
  triggers: [
    {
      abilityId: 'youGainLife-1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      memo: (_ctx, _self, ev) => (ev.t === 'LifeChanged' && ev.delta > 0 ? ev.delta : 0),
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Defiant Bloodlord - Target opponent loses that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

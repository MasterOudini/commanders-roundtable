// `Citizen V, Helmut Zemo` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CITIZEN_V_HELMUT_ZEMO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CITIZEN_V_HELMUT_ZEMO, "Lifelink\nWhenever you gain life, put a +1/+1 counter on each Villain you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on each Villain you control.", CITIZEN_V_HELMUT_ZEMO.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on each Villain you control.");

export const CITIZEN_VHELMUT_ZEMO_SCRIPT: CardScript = {
  oracleId: CITIZEN_V_HELMUT_ZEMO.oracleId,
  name: CITIZEN_V_HELMUT_ZEMO.name,
  triggers: [
    {
      abilityId: 'youGainLife-1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Citizen V, Helmut Zemo - Put a +1/+1 counter on each Villain you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

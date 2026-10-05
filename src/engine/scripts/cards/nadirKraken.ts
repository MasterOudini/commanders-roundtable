// `Nadir Kraken` - a drawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NADIR_KRAKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NADIR_KRAKEN, "Whenever you draw a card, you may pay {1}. If you do, put a +1/+1 counter on this creature and create a 1/1 blue Tentacle creature token.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, put a +1/+1 counter on this creature and create a 1/1 blue Tentacle creature token.", NADIR_KRAKEN.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, put a +1/+1 counter on this creature and create a 1/1 blue Tentacle creature token.");

export const NADIR_KRAKEN_SCRIPT: CardScript = {
  oracleId: NADIR_KRAKEN.oracleId,
  name: NADIR_KRAKEN.name,
  triggers: [
    {
      abilityId: 'drawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Nadir Kraken - You may pay {1}. If you do, put a +1/+1 counter on this creature and create a 1/1 blue Tentacle creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

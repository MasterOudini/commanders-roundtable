// `Shabraz, the Skyshark` - a drawsCard trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHABRAZ_THE_SKYSHARK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHABRAZ_THE_SKYSHARK, "Partner with Brallin, Skyshark Rider\nFlying\nWhenever you draw a card, put a +1/+1 counter on Shabraz and you gain 1 life.\n{W/U}: Target Human gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a +1/+1 counter on ~ and you gain 1 life.", SHABRAZ_THE_SKYSHARK.name);
const VOCAB_T_L2 = vocabularyTargets("Put a +1/+1 counter on ~ and you gain 1 life.");
const VOCAB_A0 = vocabularyEffects("Target Human gains flying until end of turn.", SHABRAZ_THE_SKYSHARK.name);
const VOCAB_T_A0 = vocabularyTargets("Target Human gains flying until end of turn.");

export const SHABRAZ_THE_SKYSHARK_SCRIPT: CardScript = {
  oracleId: SHABRAZ_THE_SKYSHARK.oracleId,
  name: SHABRAZ_THE_SKYSHARK.name,
  activated: [
    {
      ref: `${SHABRAZ_THE_SKYSHARK.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'drawsCard-2',
      text: LINES[2] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Shabraz, the Skyshark - Put a +1/+1 counter on ~ and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

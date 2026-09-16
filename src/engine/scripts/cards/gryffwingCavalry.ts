// `Gryffwing Cavalry` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRYFFWING_CAVALRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRYFFWING_CAVALRY, "Flying\nTraining (Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature.)\nWhenever this creature attacks, you may pay {1}{W}. If you do, target attacking creature without flying gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You may pay {1}{W}. If you do, target attacking creature without flying gains flying until end of turn.", GRYFFWING_CAVALRY.name);
const VOCAB_T_L2 = vocabularyTargets("You may pay {1}{W}. If you do, target attacking creature without flying gains flying until end of turn.");

export const GRYFFWING_CAVALRY_SCRIPT: CardScript = {
  oracleId: GRYFFWING_CAVALRY.oracleId,
  name: GRYFFWING_CAVALRY.name,
  triggers: [
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Gryffwing Cavalry - You may pay {1}{W}. If you do, target attacking creature without flying gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

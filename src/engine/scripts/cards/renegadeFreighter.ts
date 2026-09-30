// `Renegade Freighter` - a vehicleAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RENEGADE_FREIGHTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RENEGADE_FREIGHTER, "Whenever this Vehicle attacks, it gets +1/+1 and gains trample until end of turn.\nCrew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ gets +1/+1 and gains trample until end of turn.", RENEGADE_FREIGHTER.name);
const VOCAB_T_L0 = vocabularyTargets("~ gets +1/+1 and gains trample until end of turn.");

export const RENEGADE_FREIGHTER_SCRIPT: CardScript = {
  oracleId: RENEGADE_FREIGHTER.oracleId,
  name: RENEGADE_FREIGHTER.name,
  triggers: [
    {
      abilityId: 'vehicleAttacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Renegade Freighter - ~ gets +1/+1 and gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

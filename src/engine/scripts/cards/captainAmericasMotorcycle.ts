// `Captain America's Motorcycle` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTAIN_AMERICA_S_MOTORCYCLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTAIN_AMERICA_S_MOTORCYCLE, "Flash\nWhen this Vehicle enters, target creature or Vehicle gets +2/+0 until end of turn.\nCrew 1 (Tap any number of creatures you control with total power 1 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature or Vehicle gets +2/+0 until end of turn.", CAPTAIN_AMERICA_S_MOTORCYCLE.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature or Vehicle gets +2/+0 until end of turn.");

export const CAPTAIN_AMERICAS_MOTORCYCLE_SCRIPT: CardScript = {
  oracleId: CAPTAIN_AMERICA_S_MOTORCYCLE.oracleId,
  name: CAPTAIN_AMERICA_S_MOTORCYCLE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Captain America's Motorcycle - Target creature or Vehicle gets +2/+0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

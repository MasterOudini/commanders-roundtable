// `Mob Lookout` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOB_LOOKOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOB_LOOKOUT, "When this creature enters, target creature you control connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on that creature.)");

const VOCAB_L0 = vocabularyEffects("Target creature you control connives.", MOB_LOOKOUT.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control connives.");

export const MOB_LOOKOUT_SCRIPT: CardScript = {
  oracleId: MOB_LOOKOUT.oracleId,
  name: MOB_LOOKOUT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Mob Lookout - Target creature you control connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

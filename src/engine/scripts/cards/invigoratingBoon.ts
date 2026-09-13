// `Invigorating Boon` - a aPlayerCycles trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INVIGORATING_BOON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INVIGORATING_BOON, "Whenever a player cycles a card, you may put a +1/+1 counter on target creature.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature.", INVIGORATING_BOON.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const INVIGORATING_BOON_SCRIPT: CardScript = {
  oracleId: INVIGORATING_BOON.oracleId,
  name: INVIGORATING_BOON.name,
  triggers: [
    {
      abilityId: 'aPlayerCycles-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand',
        ),
      label: () => "Invigorating Boon - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

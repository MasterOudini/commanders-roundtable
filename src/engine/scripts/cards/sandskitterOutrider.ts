// `Sandskitter Outrider` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SANDSKITTER_OUTRIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SANDSKITTER_OUTRIDER, "Menace (This creature can't be blocked except by two or more creatures.)\nWhen this creature enters, it endures 2. (Put two +1/+1 counters on it or create a 2/2 white Spirit creature token.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ endures 2.", SANDSKITTER_OUTRIDER.name);
const VOCAB_T_L1 = vocabularyTargets("~ endures 2.");

export const SANDSKITTER_OUTRIDER_SCRIPT: CardScript = {
  oracleId: SANDSKITTER_OUTRIDER.oracleId,
  name: SANDSKITTER_OUTRIDER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sandskitter Outrider - ~ endures 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

// `Harvester Troll` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARVESTER_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARVESTER_TROLL, "When this creature enters, you may sacrifice a creature or land. If you do, put two +1/+1 counters on this creature.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice a creature or land. If you do, put two +1/+1 counters on this creature.", HARVESTER_TROLL.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice a creature or land. If you do, put two +1/+1 counters on this creature.");

export const HARVESTER_TROLL_SCRIPT: CardScript = {
  oracleId: HARVESTER_TROLL.oracleId,
  name: HARVESTER_TROLL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Harvester Troll - You may sacrifice a creature or land. If you do, put two +1/+1 counters on this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

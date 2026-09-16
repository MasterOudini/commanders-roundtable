// `Vizier of Tumbling Sands` - an activation vocab, a cycleThisCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIZIER_OF_TUMBLING_SANDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIZIER_OF_TUMBLING_SANDS, "{T}: Untap another target permanent.\nCycling {1}{U} ({1}{U}, Discard this card: Draw a card.)\nWhen you cycle this card, untap target permanent.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap another target permanent.", VIZIER_OF_TUMBLING_SANDS.name);
const VOCAB_T_A0 = vocabularyTargets("Untap another target permanent.");
const VOCAB_L2 = vocabularyEffects("Untap target permanent.", VIZIER_OF_TUMBLING_SANDS.name);
const VOCAB_T_L2 = vocabularyTargets("Untap target permanent.");

export const VIZIER_OF_TUMBLING_SANDS_SCRIPT: CardScript = {
  oracleId: VIZIER_OF_TUMBLING_SANDS.oracleId,
  name: VIZIER_OF_TUMBLING_SANDS.name,
  activated: [
    {
      ref: `${VIZIER_OF_TUMBLING_SANDS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'cycleThisCard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.reason === 'cycling'),
      label: () => "Vizier of Tumbling Sands - Untap target permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

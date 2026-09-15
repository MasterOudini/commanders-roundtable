// `Mournwhelk` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOURNWHELK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOURNWHELK, "When this creature enters, target player discards two cards.\nEvoke {3}{B} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target player discards two cards.", MOURNWHELK.name);
const VOCAB_T_L0 = vocabularyTargets("Target player discards two cards.");

export const MOURNWHELK_SCRIPT: CardScript = {
  oracleId: MOURNWHELK.oracleId,
  name: MOURNWHELK.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Mournwhelk - Target player discards two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

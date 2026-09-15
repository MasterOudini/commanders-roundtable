// `Vesperlark` - a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VESPERLARK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VESPERLARK, "Flying\nWhen this creature leaves the battlefield, return target creature card with power 1 or less from your graveyard to the battlefield.\nEvoke {1}{W} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature card with power 1 or less from your graveyard to the battlefield.", VESPERLARK.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature card with power 1 or less from your graveyard to the battlefield.");

export const VESPERLARK_SCRIPT: CardScript = {
  oracleId: VESPERLARK.oracleId,
  name: VESPERLARK.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Vesperlark - Return target creature card with power 1 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

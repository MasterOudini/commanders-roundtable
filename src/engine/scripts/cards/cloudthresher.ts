// `Cloudthresher` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLOUDTHRESHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOUDTHRESHER, "Flash\nReach\nWhen this creature enters, it deals 2 damage to each creature with flying and each player.\nEvoke {2}{G}{G} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("~ deals 2 damage to each creature with flying and each player.", CLOUDTHRESHER.name);
const VOCAB_T_L2 = vocabularyTargets("~ deals 2 damage to each creature with flying and each player.");

export const CLOUDTHRESHER_SCRIPT: CardScript = {
  oracleId: CLOUDTHRESHER.oracleId,
  name: CLOUDTHRESHER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Cloudthresher - ~ deals 2 damage to each creature with flying and each player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

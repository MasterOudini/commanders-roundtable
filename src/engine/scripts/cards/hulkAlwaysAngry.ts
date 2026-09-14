// `Hulk, Always Angry` - a etb trigger vocab, a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HULK_ALWAYS_ANGRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HULK_ALWAYS_ANGRY, "Trample\nWhen Hulk enters, destroy all artifacts.\nHulk attacks each combat if able.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy all artifacts.", HULK_ALWAYS_ANGRY.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy all artifacts.");

export const HULK_ALWAYS_ANGRY_SCRIPT: CardScript = {
  oracleId: HULK_ALWAYS_ANGRY.oracleId,
  name: HULK_ALWAYS_ANGRY.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Hulk, Always Angry - Destroy all artifacts.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};

// `Lesser Gargadon` - a attacks trigger vocab, a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LESSER_GARGADON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LESSER_GARGADON, "Whenever this creature attacks or blocks, sacrifice a land.");

const VOCAB_L0 = vocabularyEffects("Sacrifice a land.", LESSER_GARGADON.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice a land.");

export const LESSER_GARGADON_SCRIPT: CardScript = {
  oracleId: LESSER_GARGADON.oracleId,
  name: LESSER_GARGADON.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Lesser Gargadon - Sacrifice a land.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'blocks-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Lesser Gargadon - Sacrifice a land.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

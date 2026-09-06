// `Tethmos High Priest` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TETHMOS_HIGH_PRIEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TETHMOS_HIGH_PRIEST, "Heroic — Whenever you cast a spell that targets this creature, return target creature card with mana value 2 or less from your graveyard to the battlefield.");

const VOCAB_L0 = vocabularyEffects("Return target creature card with mana value 2 or less from your graveyard to the battlefield.", TETHMOS_HIGH_PRIEST.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature card with mana value 2 or less from your graveyard to the battlefield.");

export const TETHMOS_HIGH_PRIEST_SCRIPT: CardScript = {
  oracleId: TETHMOS_HIGH_PRIEST.oracleId,
  name: TETHMOS_HIGH_PRIEST.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tethmos High Priest - Return target creature card with mana value 2 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

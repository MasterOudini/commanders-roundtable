// `Kishla Trawlers` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KISHLA_TRAWLERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KISHLA_TRAWLERS, "When this creature enters, you may exile a creature card from your graveyard. When you do, return target instant or sorcery card from your graveyard to your hand.");

const VOCAB_L0 = vocabularyEffects("You may exile a creature card from your graveyard. When you do, return target instant or sorcery card from your graveyard to your hand.", KISHLA_TRAWLERS.name);
const VOCAB_T_L0 = vocabularyTargets("You may exile a creature card from your graveyard. When you do, return target instant or sorcery card from your graveyard to your hand.");

export const KISHLA_TRAWLERS_SCRIPT: CardScript = {
  oracleId: KISHLA_TRAWLERS.oracleId,
  name: KISHLA_TRAWLERS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Kishla Trawlers - You may exile a creature card from your graveyard. When you do, return target instant or sorcery card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

// `Wiccan, Young Avenger` - a castNoncreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WICCAN_YOUNG_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WICCAN_YOUNG_AVENGER, "Whenever you cast a noncreature spell, exile the top card of your library. Until your next end step, you may play that card.");

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. Until your next end step, you may play that card.", WICCAN_YOUNG_AVENGER.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. Until your next end step, you may play that card.");

export const WICCAN_YOUNG_AVENGER_SCRIPT: CardScript = {
  oracleId: WICCAN_YOUNG_AVENGER.oracleId,
  name: WICCAN_YOUNG_AVENGER.name,
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Wiccan, Young Avenger - Exile the top card of your library. Until your next end step, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

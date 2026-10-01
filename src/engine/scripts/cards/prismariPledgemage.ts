// `Prismari Pledgemage` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRISMARI_PLEDGEMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRISMARI_PLEDGEMAGE, "Defender\nMagecraft — Whenever you cast or copy an instant or sorcery spell, this creature can attack this turn as though it didn't have defender.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ can attack this turn as though it didn't have defender.", PRISMARI_PLEDGEMAGE.name);
const VOCAB_T_L1 = vocabularyTargets("~ can attack this turn as though it didn't have defender.");

export const PRISMARI_PLEDGEMAGE_SCRIPT: CardScript = {
  oracleId: PRISMARI_PLEDGEMAGE.oracleId,
  name: PRISMARI_PLEDGEMAGE.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Prismari Pledgemage - ~ can attack this turn as though it didn't have defender.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

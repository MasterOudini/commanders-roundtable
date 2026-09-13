// `Blistercoil Weird` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLISTERCOIL_WEIRD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLISTERCOIL_WEIRD, "Whenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn. Untap it.");

const VOCAB_L0 = vocabularyEffects("~ gets +1/+1 until end of turn. Untap it.", BLISTERCOIL_WEIRD.name);
const VOCAB_T_L0 = vocabularyTargets("~ gets +1/+1 until end of turn. Untap it.");

export const BLISTERCOIL_WEIRD_SCRIPT: CardScript = {
  oracleId: BLISTERCOIL_WEIRD.oracleId,
  name: BLISTERCOIL_WEIRD.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Blistercoil Weird - ~ gets +1/+1 until end of turn. Untap it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

// `Karok Wrangler` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAROK_WRANGLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAROK_WRANGLER, "Magecraft — Whenever you cast or copy an instant or sorcery spell, put a +1/+1 counter on target creature you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature you control.", KAROK_WRANGLER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature you control.");

export const KAROK_WRANGLER_SCRIPT: CardScript = {
  oracleId: KAROK_WRANGLER.oracleId,
  name: KAROK_WRANGLER.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Karok Wrangler - Put a +1/+1 counter on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

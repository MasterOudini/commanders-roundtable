// `Pinnacle Monk // Mystic Peak` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PINNACLE_MONK_MYSTIC_PEAK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(PINNACLE_MONK_MYSTIC_PEAK, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nWhen this creature enters, return target instant or sorcery card from your graveyard to your hand.\nAs this land enters, you may pay 3 life. If you don't, it enters tapped.\n{T}: Add {R}.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target instant or sorcery card from your graveyard to your hand.", PINNACLE_MONK_MYSTIC_PEAK.name);
const VOCAB_T_L1 = vocabularyTargets("Return target instant or sorcery card from your graveyard to your hand.");

export const PINNACLE_MONK_MYSTIC_PEAK_SCRIPT: CardScript = {
  oracleId: PINNACLE_MONK_MYSTIC_PEAK.oracleId,
  name: PINNACLE_MONK_MYSTIC_PEAK.name,
  triggers: [
    {
      abilityId: 'etb-1', face: 0,
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Pinnacle Monk // Mystic Peak - Return target instant or sorcery card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

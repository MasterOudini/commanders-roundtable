// `Strixhaven Skycoach` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STRIXHAVEN_SKYCOACH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STRIXHAVEN_SKYCOACH, "Flying\nWhen this Vehicle enters, you may search your library for a basic land card, reveal it, put it into your hand, then shuffle.\nCrew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.", STRIXHAVEN_SKYCOACH.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.");

export const STRIXHAVEN_SKYCOACH_SCRIPT: CardScript = {
  oracleId: STRIXHAVEN_SKYCOACH.oracleId,
  name: STRIXHAVEN_SKYCOACH.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Strixhaven Skycoach - Search your library for a basic land card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

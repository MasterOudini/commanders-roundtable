// `Blacklance Paragon` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLACKLANCE_PARAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLACKLANCE_PARAGON, "Flash\nWhen this creature enters, target Knight gains deathtouch and lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target Knight gains deathtouch and lifelink until end of turn.", BLACKLANCE_PARAGON.name);
const VOCAB_T_L1 = vocabularyTargets("Target Knight gains deathtouch and lifelink until end of turn.");

export const BLACKLANCE_PARAGON_SCRIPT: CardScript = {
  oracleId: BLACKLANCE_PARAGON.oracleId,
  name: BLACKLANCE_PARAGON.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Blacklance Paragon - Target Knight gains deathtouch and lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

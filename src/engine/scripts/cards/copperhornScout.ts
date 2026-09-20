// `Copperhorn Scout` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COPPERHORN_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COPPERHORN_SCOUT, "Whenever this creature attacks, untap each other creature you control.");

const VOCAB_L0 = vocabularyEffects("Untap each other creature you control.", COPPERHORN_SCOUT.name);
const VOCAB_T_L0 = vocabularyTargets("Untap each other creature you control.");

export const COPPERHORN_SCOUT_SCRIPT: CardScript = {
  oracleId: COPPERHORN_SCOUT.oracleId,
  name: COPPERHORN_SCOUT.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Copperhorn Scout - Untap each other creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

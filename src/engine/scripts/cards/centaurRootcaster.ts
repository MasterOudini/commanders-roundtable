// `Centaur Rootcaster` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CENTAUR_ROOTCASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CENTAUR_ROOTCASTER, "Whenever this creature deals combat damage to a player, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", CENTAUR_ROOTCASTER.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");

export const CENTAUR_ROOTCASTER_SCRIPT: CardScript = {
  oracleId: CENTAUR_ROOTCASTER.oracleId,
  name: CENTAUR_ROOTCASTER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Centaur Rootcaster - Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

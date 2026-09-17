// `Rowan's Stalwarts` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROWAN_S_STALWARTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROWAN_S_STALWARTS, "When this creature enters, you may search your library and/or graveyard for a card named Rowan, Fearless Sparkmage, reveal it, and put it into your hand. If you search your library this way, shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library and/or graveyard for a card named Rowan, Fearless Sparkmage, reveal it, and put it into your hand. If you search your library this way, shuffle.", ROWAN_S_STALWARTS.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library and/or graveyard for a card named Rowan, Fearless Sparkmage, reveal it, and put it into your hand. If you search your library this way, shuffle.");

export const ROWANS_STALWARTS_SCRIPT: CardScript = {
  oracleId: ROWAN_S_STALWARTS.oracleId,
  name: ROWAN_S_STALWARTS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rowan's Stalwarts - Search your library and/or graveyard for a card named Rowan, Fearless Sparkmage, reveal it, and put it into your hand. If you search your library this way, shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

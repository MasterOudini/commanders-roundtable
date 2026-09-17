// `Elspeth's Devotee` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELSPETH_S_DEVOTEE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELSPETH_S_DEVOTEE, "When this creature enters, you may search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it, and put it into your hand. If you search your library this way, shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it, and put it into your hand. If you search your library this way, shuffle.", ELSPETH_S_DEVOTEE.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it, and put it into your hand. If you search your library this way, shuffle.");

export const ELSPETHS_DEVOTEE_SCRIPT: CardScript = {
  oracleId: ELSPETH_S_DEVOTEE.oracleId,
  name: ELSPETH_S_DEVOTEE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Elspeth's Devotee - Search your library and/or graveyard for a card named Elspeth, Undaunted Hero, reveal it, and put it into your hand. If you search your library this way, shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

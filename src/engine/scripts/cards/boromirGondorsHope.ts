// `Boromir, Gondor's Hope` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOROMIR_GONDOR_S_HOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOROMIR_GONDOR_S_HOPE, "Whenever Boromir enters or attacks, look at the top six cards of your library. You may reveal a Human or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

const VOCAB_L0 = vocabularyEffects("Look at the top six cards of your library. You may reveal a Human or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", BOROMIR_GONDOR_S_HOPE.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top six cards of your library. You may reveal a Human or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

export const BOROMIR_GONDORS_HOPE_SCRIPT: CardScript = {
  oracleId: BOROMIR_GONDOR_S_HOPE.oracleId,
  name: BOROMIR_GONDOR_S_HOPE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Boromir, Gondor's Hope - Look at the top six cards of your library. You may reveal a Human or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Boromir, Gondor's Hope - Look at the top six cards of your library. You may reveal a Human or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

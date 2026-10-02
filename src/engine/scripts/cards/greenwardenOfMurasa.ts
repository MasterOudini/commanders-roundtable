// `Greenwarden of Murasa` - a etb trigger vocab, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GREENWARDEN_OF_MURASA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GREENWARDEN_OF_MURASA, "When this creature enters, you may return target card from your graveyard to your hand.\nWhen this creature dies, you may exile it. If you do, return target card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target card from your graveyard to your hand.", GREENWARDEN_OF_MURASA.name);
const VOCAB_T_L0 = vocabularyTargets("Return target card from your graveyard to your hand.");
const VOCAB_L1 = vocabularyEffects("You may exile it. If you do, return target card from your graveyard to your hand.", GREENWARDEN_OF_MURASA.name);
const VOCAB_T_L1 = vocabularyTargets("You may exile it. If you do, return target card from your graveyard to your hand.");

export const GREENWARDEN_OF_MURASA_SCRIPT: CardScript = {
  oracleId: GREENWARDEN_OF_MURASA.oracleId,
  name: GREENWARDEN_OF_MURASA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Greenwarden of Murasa - Return target card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Greenwarden of Murasa - You may exile it. If you do, return target card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

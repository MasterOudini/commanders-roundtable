// `Fairgrounds Warden` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAIRGROUNDS_WARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAIRGROUNDS_WARDEN, "When this creature enters, exile target creature an opponent controls until this creature leaves the battlefield.");

const VOCAB_L0 = vocabularyEffects("Exile target creature an opponent controls until this creature leaves the battlefield.", FAIRGROUNDS_WARDEN.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature an opponent controls until this creature leaves the battlefield.");

export const FAIRGROUNDS_WARDEN_SCRIPT: CardScript = {
  oracleId: FAIRGROUNDS_WARDEN.oracleId,
  name: FAIRGROUNDS_WARDEN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Fairgrounds Warden - Exile target creature an opponent controls until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

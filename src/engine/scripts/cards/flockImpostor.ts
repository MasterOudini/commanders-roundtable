// `Flock Impostor` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLOCK_IMPOSTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOCK_IMPOSTOR, "Changeling (This card is every creature type.)\nFlash\nFlying\nWhen this creature enters, return up to one other target creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L3 = vocabularyEffects("Return up to one other target creature you control to its owner's hand.", FLOCK_IMPOSTOR.name);
const VOCAB_T_L3 = vocabularyTargets("Return up to one other target creature you control to its owner's hand.");

export const FLOCK_IMPOSTOR_SCRIPT: CardScript = {
  oracleId: FLOCK_IMPOSTOR.oracleId,
  name: FLOCK_IMPOSTOR.name,
  triggers: [
    {
      abilityId: 'etb-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Flock Impostor - Return up to one other target creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};

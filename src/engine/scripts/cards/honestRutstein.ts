// `Honest Rutstein` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HONEST_RUTSTEIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HONEST_RUTSTEIN, "When Honest Rutstein enters, return target creature card from your graveyard to your hand.\nCreature spells you cast cost {1} less to cast.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target creature card from your graveyard to your hand.", HONEST_RUTSTEIN.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature card from your graveyard to your hand.");

export const HONEST_RUTSTEIN_SCRIPT: CardScript = {
  oracleId: HONEST_RUTSTEIN.oracleId,
  name: HONEST_RUTSTEIN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Honest Rutstein - Return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

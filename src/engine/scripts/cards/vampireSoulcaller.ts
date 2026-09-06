// `Vampire Soulcaller` - a static cantBlock, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VAMPIRE_SOULCALLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAMPIRE_SOULCALLER, "Flying\nThis creature can't block.\nWhen this creature enters, return target creature card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return target creature card from your graveyard to your hand.", VAMPIRE_SOULCALLER.name);
const VOCAB_T_L2 = vocabularyTargets("Return target creature card from your graveyard to your hand.");

export const VAMPIRE_SOULCALLER_SCRIPT: CardScript = {
  oracleId: VAMPIRE_SOULCALLER.oracleId,
  name: VAMPIRE_SOULCALLER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Vampire Soulcaller - Return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};

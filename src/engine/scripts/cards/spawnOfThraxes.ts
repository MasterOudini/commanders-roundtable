// `Spawn of Thraxes` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPAWN_OF_THRAXES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPAWN_OF_THRAXES, "Flying\nWhen this creature enters, it deals damage to any target equal to the number of Mountains you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals damage to any target equal to the number of Mountains you control.", SPAWN_OF_THRAXES.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals damage to any target equal to the number of Mountains you control.");

export const SPAWN_OF_THRAXES_SCRIPT: CardScript = {
  oracleId: SPAWN_OF_THRAXES.oracleId,
  name: SPAWN_OF_THRAXES.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Spawn of Thraxes - ~ deals damage to any target equal to the number of Mountains you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

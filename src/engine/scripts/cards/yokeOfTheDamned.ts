// `Yoke of the Damned` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YOKE_OF_THE_DAMNED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YOKE_OF_THE_DAMNED, "Enchant creature\nWhen a creature dies, destroy enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy enchanted creature.", YOKE_OF_THE_DAMNED.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy enchanted creature.");

export const YOKE_OF_THE_DAMNED_SCRIPT: CardScript = {
  oracleId: YOKE_OF_THE_DAMNED.oracleId,
  name: YOKE_OF_THE_DAMNED.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Yoke of the Damned - Destroy enchanted creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

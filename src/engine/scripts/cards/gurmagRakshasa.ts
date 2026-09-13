// `Gurmag Rakshasa` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GURMAG_RAKSHASA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GURMAG_RAKSHASA, "Menace (This creature can't be blocked except by two or more creatures.)\nWhen this creature enters, target creature an opponent controls gets -2/-2 until end of turn and target creature you control gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature an opponent controls gets -2/-2 until end of turn and target creature you control gets +2/+2 until end of turn.", GURMAG_RAKSHASA.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature an opponent controls gets -2/-2 until end of turn and target creature you control gets +2/+2 until end of turn.");

export const GURMAG_RAKSHASA_SCRIPT: CardScript = {
  oracleId: GURMAG_RAKSHASA.oracleId,
  name: GURMAG_RAKSHASA.name,
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
      label: () => "Gurmag Rakshasa - Target creature an opponent controls gets -2/-2 until end of turn and target creature you control gets +2/+2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

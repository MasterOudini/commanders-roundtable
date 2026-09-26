// `Night Clubber` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIGHT_CLUBBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIGHT_CLUBBER, "When this creature enters, creatures your opponents control get -1/-1 until end of turn.\nBlitz {2}{B} (If you cast this spell for its blitz cost, it gains haste and \"When this creature dies, draw a card.\" Sacrifice it at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Creatures your opponents control get -1/-1 until end of turn.", NIGHT_CLUBBER.name);
const VOCAB_T_L0 = vocabularyTargets("Creatures your opponents control get -1/-1 until end of turn.");

export const NIGHT_CLUBBER_SCRIPT: CardScript = {
  oracleId: NIGHT_CLUBBER.oracleId,
  name: NIGHT_CLUBBER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Night Clubber - Creatures your opponents control get -1/-1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

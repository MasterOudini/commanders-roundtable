// `Archfiend of Sorrows` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCHFIEND_OF_SORROWS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCHFIEND_OF_SORROWS, "Flying\nWhen this creature enters, creatures your opponents control get -2/-2 until end of turn.\nUnearth {3}{B}{B} ({3}{B}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Creatures your opponents control get -2/-2 until end of turn.", ARCHFIEND_OF_SORROWS.name);
const VOCAB_T_L1 = vocabularyTargets("Creatures your opponents control get -2/-2 until end of turn.");

export const ARCHFIEND_OF_SORROWS_SCRIPT: CardScript = {
  oracleId: ARCHFIEND_OF_SORROWS.oracleId,
  name: ARCHFIEND_OF_SORROWS.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Archfiend of Sorrows - Creatures your opponents control get -2/-2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

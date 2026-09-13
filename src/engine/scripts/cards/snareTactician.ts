// `Snare Tactician` - a youCycle trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SNARE_TACTICIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SNARE_TACTICIAN, "Whenever you cycle a card, tap target creature an opponent controls.");

const VOCAB_L0 = vocabularyEffects("Tap target creature an opponent controls.", SNARE_TACTICIAN.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature an opponent controls.");

export const SNARE_TACTICIAN_SCRIPT: CardScript = {
  oracleId: SNARE_TACTICIAN.oracleId,
  name: SNARE_TACTICIAN.name,
  triggers: [
    {
      abilityId: 'youCycle-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Snare Tactician - Tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

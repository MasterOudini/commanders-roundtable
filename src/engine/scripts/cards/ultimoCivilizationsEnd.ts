// `Ultimo, Civilization's End` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ULTIMO_CIVILIZATION_S_END } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ULTIMO_CIVILIZATION_S_END, "Menace (This creature can't be blocked except by two or more creatures.)\nWhen Ultimo enters, each opponent sacrifices a creature of their choice.\n{2}{B}, Discard this card: Each opponent sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent sacrifices a creature of their choice.", ULTIMO_CIVILIZATION_S_END.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent sacrifices a creature of their choice.");
const VOCAB_A0 = vocabularyEffects("Each opponent sacrifices a creature of their choice.", ULTIMO_CIVILIZATION_S_END.name);
const VOCAB_T_A0 = vocabularyTargets("Each opponent sacrifices a creature of their choice.");

export const ULTIMO_CIVILIZATIONS_END_SCRIPT: CardScript = {
  oracleId: ULTIMO_CIVILIZATION_S_END.oracleId,
  name: ULTIMO_CIVILIZATION_S_END.name,
  activated: [
    {
      ref: `${ULTIMO_CIVILIZATION_S_END.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ultimo, Civilization's End - Each opponent sacrifices a creature of their choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

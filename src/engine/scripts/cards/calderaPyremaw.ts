// `Caldera Pyremaw` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CALDERA_PYREMAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CALDERA_PYREMAW, "Flying\nWhenever you cast an instant or sorcery spell, put a +1/+1 counter on this creature. Then this creature deals damage equal to its power to target opponent.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on this creature. Then this creature deals damage equal to its power to target opponent.", CALDERA_PYREMAW.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on this creature. Then this creature deals damage equal to its power to target opponent.");

export const CALDERA_PYREMAW_SCRIPT: CardScript = {
  oracleId: CALDERA_PYREMAW.oracleId,
  name: CALDERA_PYREMAW.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Caldera Pyremaw - Put a +1/+1 counter on this creature. Then this creature deals damage equal to its power to target opponent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

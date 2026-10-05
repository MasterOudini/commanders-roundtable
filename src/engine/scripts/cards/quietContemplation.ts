// `Quiet Contemplation` - a castNoncreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUIET_CONTEMPLATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUIET_CONTEMPLATION, "Whenever you cast a noncreature spell, you may pay {1}. If you do, tap target creature an opponent controls and it doesn't untap during its controller's next untap step.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, tap target creature an opponent controls and it doesn't untap during its controller's next untap step.", QUIET_CONTEMPLATION.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, tap target creature an opponent controls and it doesn't untap during its controller's next untap step.");

export const QUIET_CONTEMPLATION_SCRIPT: CardScript = {
  oracleId: QUIET_CONTEMPLATION.oracleId,
  name: QUIET_CONTEMPLATION.name,
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Quiet Contemplation - You may pay {1}. If you do, tap target creature an opponent controls and it doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

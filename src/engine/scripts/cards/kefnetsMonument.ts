// `Kefnet's Monument` - a castCreatureSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KEFNET_S_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KEFNET_S_MONUMENT, "Blue creature spells you cast cost {1} less to cast.\nWhenever you cast a creature spell, target creature an opponent controls doesn't untap during its controller's next untap step.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature an opponent controls doesn't untap during its controller's next untap step.", KEFNET_S_MONUMENT.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature an opponent controls doesn't untap during its controller's next untap step.");

export const KEFNETS_MONUMENT_SCRIPT: CardScript = {
  oracleId: KEFNET_S_MONUMENT.oracleId,
  name: KEFNET_S_MONUMENT.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Kefnet's Monument - Target creature an opponent controls doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

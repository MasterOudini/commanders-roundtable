// `Rhonas's Monument` - a castCreatureSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RHONAS_S_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RHONAS_S_MONUMENT, "Green creature spells you cast cost {1} less to cast.\nWhenever you cast a creature spell, target creature you control gets +2/+2 and gains trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature you control gets +2/+2 and gains trample until end of turn.", RHONAS_S_MONUMENT.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature you control gets +2/+2 and gains trample until end of turn.");

export const RHONASS_MONUMENT_SCRIPT: CardScript = {
  oracleId: RHONAS_S_MONUMENT.oracleId,
  name: RHONAS_S_MONUMENT.name,
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
      label: () => "Rhonas's Monument - Target creature you control gets +2/+2 and gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

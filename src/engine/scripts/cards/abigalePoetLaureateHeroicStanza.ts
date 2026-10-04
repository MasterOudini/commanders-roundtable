// `Abigale, Poet Laureate // Heroic Stanza` - a castCreatureSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABIGALE_POET_LAUREATE_HEROIC_STANZA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(ABIGALE_POET_LAUREATE_HEROIC_STANZA, "Flying\nWhenever you cast a creature spell, Abigale becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nPut a +1/+1 counter on target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ becomes prepared.", ABIGALE_POET_LAUREATE_HEROIC_STANZA.name);
const VOCAB_T_L1 = vocabularyTargets("~ becomes prepared.");

export const ABIGALE_POET_LAUREATE_HEROIC_STANZA_SCRIPT: CardScript = {
  oracleId: ABIGALE_POET_LAUREATE_HEROIC_STANZA.oracleId,
  name: ABIGALE_POET_LAUREATE_HEROIC_STANZA.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-1', face: 0,
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Abigale, Poet Laureate // Heroic Stanza - ~ becomes prepared.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

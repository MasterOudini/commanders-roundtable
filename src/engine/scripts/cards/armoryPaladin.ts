// `Armory Paladin` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARMORY_PALADIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARMORY_PALADIN, "Trample\nWhenever you cast an Aura or Equipment spell, exile the top card of your library. You may play that card until the end of your next turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top card of your library. You may play that card until the end of your next turn.", ARMORY_PALADIN.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top card of your library. You may play that card until the end of your next turn.");

export const ARMORY_PALADIN_SCRIPT: CardScript = {
  oracleId: ARMORY_PALADIN.oracleId,
  name: ARMORY_PALADIN.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.subtypes.includes('Aura') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Equipment')),
      label: () => "Armory Paladin - Exile the top card of your library. You may play that card until the end of your next turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

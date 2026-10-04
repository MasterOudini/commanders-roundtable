// `Galvanic Giant // Storm Reading` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GALVANIC_GIANT_STORM_READING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GALVANIC_GIANT_STORM_READING, "Whenever you cast a spell with mana value 5 or greater, tap target creature an opponent controls and put a stun counter on it.\nDraw four cards, then discard two cards. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Tap target creature an opponent controls and put a stun counter on it.", GALVANIC_GIANT_STORM_READING.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature an opponent controls and put a stun counter on it.");

export const GALVANIC_GIANT_STORM_READING_SCRIPT: CardScript = {
  oracleId: GALVANIC_GIANT_STORM_READING.oracleId,
  name: GALVANIC_GIANT_STORM_READING.name,
  triggers: [
    {
      abilityId: 'castSpell-0', face: 0,
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).manaValue ?? 0) >= 5,
      label: () => "Galvanic Giant // Storm Reading - Tap target creature an opponent controls and put a stun counter on it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

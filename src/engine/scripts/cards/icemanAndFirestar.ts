// `Iceman and Firestar` - a castSpell trigger vocab, a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICEMAN_AND_FIRESTAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICEMAN_AND_FIRESTAR, "Flying\nWhenever you cast a blue spell, tap up to one target creature.\nWhenever you cast a red spell, you may discard a card. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap up to one target creature.", ICEMAN_AND_FIRESTAR.name);
const VOCAB_T_L1 = vocabularyTargets("Tap up to one target creature.");
const VOCAB_L2 = vocabularyEffects("You may discard a card. If you do, draw a card.", ICEMAN_AND_FIRESTAR.name);
const VOCAB_T_L2 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const ICEMAN_AND_FIRESTAR_SCRIPT: CardScript = {
  oracleId: ICEMAN_AND_FIRESTAR.oracleId,
  name: ICEMAN_AND_FIRESTAR.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('U'),
      label: () => "Iceman and Firestar - Tap up to one target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'castSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Iceman and Firestar - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

// `Sawblade Scamp` - a castNoncreature trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAWBLADE_SCAMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAWBLADE_SCAMP, "Haste\nWhenever you cast a noncreature spell, put an oil counter on this creature.\n{T}, Remove an oil counter from this creature: It deals 1 damage to each opponent.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("It deals 1 damage to each opponent.", SAWBLADE_SCAMP.name);
const VOCAB_T_A0 = vocabularyTargets("It deals 1 damage to each opponent.");

export const SAWBLADE_SCAMP_SCRIPT: CardScript = {
  oracleId: SAWBLADE_SCAMP.oracleId,
  name: SAWBLADE_SCAMP.name,
  activated: [
    {
      ref: `${SAWBLADE_SCAMP.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castNoncreature-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Sawblade Scamp - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
  ],
};

// `Levitating Statue` - a castNoncreature trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEVITATING_STATUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEVITATING_STATUE, "Flying\nWhenever you cast a noncreature spell, put a +1/+1 counter on this artifact.\n{2}: This artifact becomes a 1/1 Construct artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on this artifact.", LEVITATING_STATUE.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("~ becomes a 1/1 Construct artifact creature until end of turn.", LEVITATING_STATUE.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes a 1/1 Construct artifact creature until end of turn.");

export const LEVITATING_STATUE_SCRIPT: CardScript = {
  oracleId: LEVITATING_STATUE.oracleId,
  name: LEVITATING_STATUE.name,
  activated: [
    {
      ref: `${LEVITATING_STATUE.oracleId}#a0`,
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
      label: () => "Levitating Statue - Put a +1/+1 counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

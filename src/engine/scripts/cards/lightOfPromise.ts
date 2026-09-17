// `Light of Promise` - a static attachedStatic, a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIGHT_OF_PROMISE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(LIGHT_OF_PROMISE, "Enchant creature\nEnchanted creature has \"Whenever you gain life, put that many +1/+1 counters on this creature.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put that many +1/+1 counters on ~.", LIGHT_OF_PROMISE.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Put that many +1/+1 counters on ~.");

const GRANT_1 = grantedTriggerRef(`${LIGHT_OF_PROMISE.oracleId}#gt1`, LIGHT_OF_PROMISE.name);

export const LIGHT_OF_PROMISE_SCRIPT: CardScript = {
  oracleId: LIGHT_OF_PROMISE.oracleId,
  name: LIGHT_OF_PROMISE.name,
  triggers: [
    {
      abilityId: 'gt1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      memo: (_ctx, _self, ev) => (ev.t === 'LifeChanged' && ev.delta > 0 ? ev.delta : 0),
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Light of Promise - Put that many +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_1 });
      },
    },
  ],
};

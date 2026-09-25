// `Skittering Crustacean` - an activation vocab, a conditional static (as long as this creature is monstrous) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKITTERING_CRUSTACEAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(SKITTERING_CRUSTACEAN, "{6}{U}: Monstrosity 4. (If this creature isn't monstrous, put four +1/+1 counters on it and it becomes monstrous.)\nAs long as this creature is monstrous, it has hexproof. (It can't be the target of spells or abilities your opponents control.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Monstrosity 4.", SKITTERING_CRUSTACEAN.name);
const VOCAB_T_A0 = vocabularyTargets("Monstrosity 4.");

// "as long as this creature is monstrous" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.cards[self]?.monstrous === true;
}


export const SKITTERING_CRUSTACEAN_SCRIPT: CardScript = {
  oracleId: SKITTERING_CRUSTACEAN.oracleId,
  name: SKITTERING_CRUSTACEAN.name,
  activated: [
    {
      ref: `${SKITTERING_CRUSTACEAN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("hexproof");
      },
    },
  ],
};

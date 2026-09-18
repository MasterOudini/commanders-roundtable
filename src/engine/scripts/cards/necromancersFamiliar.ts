// `Necromancer's Familiar` - a conditional static (as long as you have no cards in hand) threshold, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NECROMANCER_S_FAMILIAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NECROMANCER_S_FAMILIAR, "Flying\nHellbent — This creature has lifelink as long as you have no cards in hand.\n{B}, Discard a card: This creature gains indestructible until end of turn. Tap it.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gains indestructible until end of turn. Tap it.", NECROMANCER_S_FAMILIAR.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains indestructible until end of turn. Tap it.");

// "as long as you have no cards in hand" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.zones.hand[me] ?? []).length <= 0;
}


export const NECROMANCERS_FAMILIAR_SCRIPT: CardScript = {
  oracleId: NECROMANCER_S_FAMILIAR.oracleId,
  name: NECROMANCER_S_FAMILIAR.name,
  activated: [
    {
      ref: `${NECROMANCER_S_FAMILIAR.oracleId}#a0`,
      text: LINES[2] as string,
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
        chars.keywords.add("lifelink");
      },
    },
  ],
};

// `Radha, Heart of Keld` - a conditional static (as long as it's your turn) threshold, a static topOfLibrary, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RADHA_HEART_OF_KELD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RADHA_HEART_OF_KELD, "During your turn, Radha has first strike.\nYou may look at the top card of your library any time, and you may play lands from the top of your library.\n{4}{R}{G}: Radha gets +X/+X until end of turn, where X is the number of lands you control.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +X/+X until end of turn, where X is the number of lands you control.", RADHA_HEART_OF_KELD.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +X/+X until end of turn, where X is the number of lands you control.");

// "as long as it's your turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.activePlayer === me;
}


export const RADHA_HEART_OF_KELD_SCRIPT: CardScript = {
  oracleId: RADHA_HEART_OF_KELD.oracleId,
  name: RADHA_HEART_OF_KELD.name,
  activated: [
    {
      ref: `${RADHA_HEART_OF_KELD.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  topOfLibrary: [
    { abilityId: "top-1", text: LINES[1] as string, look: true, lands: true },
  ],
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};

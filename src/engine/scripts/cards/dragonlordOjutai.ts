// `Dragonlord Ojutai` - a conditional static (as long as it's untapped) threshold, a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGONLORD_OJUTAI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAGONLORD_OJUTAI, "Flying\nDragonlord Ojutai has hexproof as long as it's untapped.\nWhenever Dragonlord Ojutai deals combat damage to a player, look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.", DRAGONLORD_OJUTAI.name);
const VOCAB_T_L2 = vocabularyTargets("Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.");

// "as long as it's untapped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.tapped ?? false) === false;
}


export const DRAGONLORD_OJUTAI_SCRIPT: CardScript = {
  oracleId: DRAGONLORD_OJUTAI.oracleId,
  name: DRAGONLORD_OJUTAI.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Dragonlord Ojutai - Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
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

// `Gastal Raider` - a etb trigger vocab, a conditional static (as long as you have max speed) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GASTAL_RAIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GASTAL_RAIDER, "Start your engines!\nWhen this creature enters, target opponent reveals their hand. You choose an instant or sorcery card from it. That player discards that card.\nMax speed — This creature gets +1/+1 and has menace.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent reveals their hand. You choose an instant or sorcery card from it. That player discards that card.", GASTAL_RAIDER.name);
const VOCAB_T_L1 = vocabularyTargets("Target opponent reveals their hand. You choose an instant or sorcery card from it. That player discards that card.");

// "as long as you have max speed" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.speed ?? 0) >= 4;
}


export const GASTAL_RAIDER_SCRIPT: CardScript = {
  oracleId: GASTAL_RAIDER.oracleId,
  name: GASTAL_RAIDER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gastal Raider - Target opponent reveals their hand. You choose an instant or sorcery card from it. That player discards that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond2Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'threshold-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond2Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};

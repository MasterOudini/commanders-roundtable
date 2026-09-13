// `Tenured Concocter` - a becomesTargetedByOpponent trigger draw, a conditional static (as long as you gained life this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TENURED_CONCOCTER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(TENURED_CONCOCTER, "Vigilance\nWhenever this creature becomes the target of a spell or ability an opponent controls, you may draw a card.\nInfusion — This creature gets +2/+0 as long as you gained life this turn.");
const LINES = PRINTED.split('\n');

// "as long as you gained life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.gainedLife[me] === true;
}


export const TENURED_CONCOCTER_SCRIPT: CardScript = {
  oracleId: TENURED_CONCOCTER.oracleId,
  name: TENURED_CONCOCTER.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByOpponent-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tenured Concocter - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'becomesTargetedByOpponentAbility-1',
      text: LINES[1] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tenured Concocter - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
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
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};

// `Crested Sunmare` - a static anthem, a eachEndStep trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRESTED_SUNMARE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(CRESTED_SUNMARE, "Other Horses you control have indestructible.\nAt the beginning of each end step, if you gained life this turn, create a 5/5 white Horse creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Horse|5/5|W|Creature|");

// "as long as you gained life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.gainedLife[me] === true;
}


export const CRESTED_SUNMARE_SCRIPT: CardScript = {
  oracleId: CRESTED_SUNMARE.oracleId,
  name: CRESTED_SUNMARE.name,
  triggers: [
    {
      abilityId: 'eachEndStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Crested Sunmare - token",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Horse") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("indestructible");
      },
    },
  ],
};

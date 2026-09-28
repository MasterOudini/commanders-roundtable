// `Wolfbitten Captive // Krallenhorde Killer` - an activation pumping itself, a eachUpkeep trigger vocab, an activation pumping itself, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER, "{1}{G}: This creature gets +2/+2 until end of turn. Activate only once each turn.\nAt the beginning of each upkeep, if no spells were cast last turn, transform this creature.\n{3}{G}: This creature gets +4/+4 until end of turn. Activate only once each turn.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");
const VOCAB_L3 = transformFrom(vocabularyEffects("Transform this creature.", WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER.name), 1);
const VOCAB_T_L3 = vocabularyTargets("Transform this creature.");

// "as long as no spells were cast last turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return Object.values(ctx.state.turn.lastTurnSpells ?? {}).every((k) => k === 0);
}

// "as long as a player cast two or more spells last turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond3Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return Object.values(ctx.state.turn.lastTurnSpells ?? {}).some((k) => k >= 2);
}


export const WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER_SCRIPT: CardScript = {
  oracleId: WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER.oracleId,
  name: WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER.name,
  activated: [
    {
      ref: `${WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
    {
      ref: `${WOLFBITTEN_CAPTIVE_KRALLENHORDE_KILLER.oracleId}#a0`, face: 1,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 4, toughness: 4 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'eachUpkeep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Wolfbitten Captive // Krallenhorde Killer - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'eachUpkeep-3', face: 1,
      text: LINES[3] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond3Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Wolfbitten Captive // Krallenhorde Killer - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};

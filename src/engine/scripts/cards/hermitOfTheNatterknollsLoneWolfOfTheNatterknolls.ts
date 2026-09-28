// `Hermit of the Natterknolls // Lone Wolf of the Natterknolls` - a opponentCastsSpell trigger draw, a eachUpkeep trigger vocab, a opponentCastsSpell trigger drawN, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS, "Whenever an opponent casts a spell during your turn, draw a card.\nAt the beginning of each upkeep, if no spells were cast last turn, transform this creature.\nWhenever an opponent casts a spell during your turn, draw two cards.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");
const VOCAB_L3 = transformFrom(vocabularyEffects("Transform this creature.", HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS.name), 1);
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


export const HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS_SCRIPT: CardScript = {
  oracleId: HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS.oracleId,
  name: HERMIT_OF_THE_NATTERKNOLLS_LONE_WOLF_OF_THE_NATTERKNOLLS.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0', face: 0,
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self)),
      label: () => "Hermit of the Natterknolls // Lone Wolf of the Natterknolls - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'eachUpkeep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Hermit of the Natterknolls // Lone Wolf of the Natterknolls - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'opponentCastsSpell-2', face: 1,
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self)),
      label: () => "Hermit of the Natterknolls // Lone Wolf of the Natterknolls - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
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
      label: () => "Hermit of the Natterknolls // Lone Wolf of the Natterknolls - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};

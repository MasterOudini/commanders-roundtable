// `Ulvenwald Mystics // Ulvenwald Primordials` - a eachUpkeep trigger vocab, an activation regenerate, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS, "At the beginning of each upkeep, if no spells were cast last turn, transform this creature.\n{G}: Regenerate this creature.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = transformFrom(vocabularyEffects("Transform this creature.", ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS.name), 0);
const VOCAB_T_L0 = vocabularyTargets("Transform this creature.");
const VOCAB_L2 = transformFrom(vocabularyEffects("Transform this creature.", ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS.name), 1);
const VOCAB_T_L2 = vocabularyTargets("Transform this creature.");

// "as long as no spells were cast last turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return Object.values(ctx.state.turn.lastTurnSpells ?? {}).every((k) => k === 0);
}

// "as long as a player cast two or more spells last turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return Object.values(ctx.state.turn.lastTurnSpells ?? {}).some((k) => k >= 2);
}


export const ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS_SCRIPT: CardScript = {
  oracleId: ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS.oracleId,
  name: ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS.name,
  activated: [
    {
      ref: `${ULVENWALD_MYSTICS_ULVENWALD_PRIMORDIALS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'eachUpkeep-0', face: 0,
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Ulvenwald Mystics // Ulvenwald Primordials - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'eachUpkeep-2', face: 1,
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Ulvenwald Mystics // Ulvenwald Primordials - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

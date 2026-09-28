// `Panicked Bystander // Cackling Culprit` - a dies trigger gainLife, a anotherCreatureDies trigger gainLife, a endStep trigger vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PANICKED_BYSTANDER_CACKLING_CULPRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PANICKED_BYSTANDER_CACKLING_CULPRIT, "Whenever this creature or another creature you control dies, you gain 1 life.\nAt the beginning of your end step, if you gained 3 or more life this turn, transform this creature.\nWhenever this creature or another creature you control dies, you gain 1 life.\n{1}{B}: This creature gains deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", PANICKED_BYSTANDER_CACKLING_CULPRIT.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");

// "as long as you gained 3 or more life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.lifeGained[me] ?? 0) >= 3;
}


export const PANICKED_BYSTANDER_CACKLING_CULPRIT_SCRIPT: CardScript = {
  oracleId: PANICKED_BYSTANDER_CACKLING_CULPRIT.oracleId,
  name: PANICKED_BYSTANDER_CACKLING_CULPRIT.name,
  activated: [
    {
      ref: `${PANICKED_BYSTANDER_CACKLING_CULPRIT.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Panicked Bystander // Cackling Culprit - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
    {
      abilityId: 'anotherCreatureDies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Panicked Bystander // Cackling Culprit - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
    {
      abilityId: 'endStep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Panicked Bystander // Cackling Culprit - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

// `Sidequest: Card Collection // Magicked Card` - a etb trigger vocab, a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD, "When this enchantment enters, draw three cards, then discard two cards.\nAt the beginning of your end step, if eight or more cards are in your graveyard, transform this enchantment.\nFlying\nCrew 1 (Tap any number of creatures you control with total power 1 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Draw three cards, then discard two cards.", SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD.name);
const VOCAB_T_L0 = vocabularyTargets("Draw three cards, then discard two cards.");
const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this enchantment.", SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this enchantment.");

// "as long as eight or more cards are in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.zones.graveyard[me] ?? []).length >= 8;
}


export const SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD_SCRIPT: CardScript = {
  oracleId: SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD.oracleId,
  name: SIDEQUEST_CARD_COLLECTION_MAGICKED_CARD.name,
  triggers: [
    {
      abilityId: 'etb-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sidequest: Card Collection // Magicked Card - Draw three cards, then discard two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
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
      label: () => "Sidequest: Card Collection // Magicked Card - Transform this enchantment.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

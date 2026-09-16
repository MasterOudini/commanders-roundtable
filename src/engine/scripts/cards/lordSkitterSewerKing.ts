// `Lord Skitter, Sewer King` - a anotherCreatureEnters trigger vocab, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LORD_SKITTER_SEWER_KING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(LORD_SKITTER_SEWER_KING, "Whenever another Rat you control enters, exile up to one target card from an opponent's graveyard.\nAt the beginning of combat on your turn, create a 1/1 black Rat creature token with \"This token can't block.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile up to one target card from an opponent's graveyard.", LORD_SKITTER_SEWER_KING.name);
const VOCAB_T_L0 = vocabularyTargets("Exile up to one target card from an opponent's graveyard.");
const VOCAB_L1 = vocabularyEffects("Create a 1/1 black Rat creature token with \"This token can't block.\"", LORD_SKITTER_SEWER_KING.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 black Rat creature token with \"This token can't block.\"");

export const LORD_SKITTER_SEWER_KING_SCRIPT: CardScript = {
  oracleId: LORD_SKITTER_SEWER_KING.oracleId,
  name: LORD_SKITTER_SEWER_KING.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Rat'),
        ),
      label: () => "Lord Skitter, Sewer King - Exile up to one target card from an opponent's graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Lord Skitter, Sewer King - Create a 1/1 black Rat creature token with \"This token can't block.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

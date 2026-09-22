// `Conduit Goblin` - a etb trigger vocab, a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONDUIT_GOBLIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONDUIT_GOBLIN, "When this creature enters, you get {E}{E} (two energy counters).\nAt the beginning of combat on your turn, you may pay {E}. If you do, another target creature you control gets +1/+0 and gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}.", CONDUIT_GOBLIN.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}.");
const VOCAB_L1 = vocabularyEffects("You may pay {E}. If you do, another target creature you control gets +1/+0 and gains haste until end of turn.", CONDUIT_GOBLIN.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {E}. If you do, another target creature you control gets +1/+0 and gains haste until end of turn.");

export const CONDUIT_GOBLIN_SCRIPT: CardScript = {
  oracleId: CONDUIT_GOBLIN.oracleId,
  name: CONDUIT_GOBLIN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Conduit Goblin - You get {E}{E}.",
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
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Conduit Goblin - You may pay {E}. If you do, another target creature you control gets +1/+0 and gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

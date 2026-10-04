// `Nyx Weaver` - a upkeep trigger mill, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NYX_WEAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NYX_WEAVER, "Reach\nAt the beginning of your upkeep, mill two cards. (Put the top two cards of your library into your graveyard.)\n{1}{B}{G}, Exile this creature: Return target card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target card from your graveyard to your hand.", NYX_WEAVER.name);
const VOCAB_T_A0 = vocabularyTargets("Return target card from your graveyard to your hand.");

export const NYX_WEAVER_SCRIPT: CardScript = {
  oracleId: NYX_WEAVER.oracleId,
  name: NYX_WEAVER.name,
  activated: [
    {
      ref: `${NYX_WEAVER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Nyx Weaver - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 2));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};

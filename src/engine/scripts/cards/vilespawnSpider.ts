// `Vilespawn Spider` - a upkeep trigger mill, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VILESPAWN_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VILESPAWN_SPIDER, "Reach\nAt the beginning of your upkeep, mill a card. (Put the top card of your library into your graveyard.)\n{2}{G}{U}, {T}, Sacrifice this creature: Create a 1/1 green Insect creature token for each creature card in your graveyard. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Create a 1/1 green Insect creature token for each creature card in your graveyard.", VILESPAWN_SPIDER.name);
const VOCAB_T_A0 = vocabularyTargets("Create a 1/1 green Insect creature token for each creature card in your graveyard.");

export const VILESPAWN_SPIDER_SCRIPT: CardScript = {
  oracleId: VILESPAWN_SPIDER.oracleId,
  name: VILESPAWN_SPIDER.name,
  activated: [
    {
      ref: `${VILESPAWN_SPIDER.oracleId}#a0`,
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
      label: () => "Vilespawn Spider - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 1));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};

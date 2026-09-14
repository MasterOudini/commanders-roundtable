// `Scrawling Crawler` - a upkeep trigger vocab, a opponentDrawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCRAWLING_CRAWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCRAWLING_CRAWLER, "At the beginning of your upkeep, each player draws a card.\nWhenever an opponent draws a card, that player loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Each player draws a card.", SCRAWLING_CRAWLER.name);
const VOCAB_T_L0 = vocabularyTargets("Each player draws a card.");
const VOCAB_L1 = vocabularyEffects("Target player loses 1 life.", SCRAWLING_CRAWLER.name);
const VOCAB_T_L1 = vocabularyTargets("Target player loses 1 life.");

export const SCRAWLING_CRAWLER_SCRIPT: CardScript = {
  oracleId: SCRAWLING_CRAWLER.oracleId,
  name: SCRAWLING_CRAWLER.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Scrawling Crawler - Each player draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'opponentDrawsCard-1',
      text: LINES[1] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      playerOf: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.player : null),
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player !== ctx.query.controllerOf(self),
      label: () => "Scrawling Crawler - Target player loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L1.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

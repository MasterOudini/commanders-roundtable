// `Sheoldred, the Apocalypse` - a drawsCard trigger gainLife, a opponentDrawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHEOLDRED_THE_APOCALYPSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHEOLDRED_THE_APOCALYPSE, "Deathtouch\nWhenever you draw a card, you gain 2 life.\nWhenever an opponent draws a card, they lose 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target player loses 2 life.", SHEOLDRED_THE_APOCALYPSE.name);
const VOCAB_T_L2 = vocabularyTargets("Target player loses 2 life.");

export const SHEOLDRED_THE_APOCALYPSE_SCRIPT: CardScript = {
  oracleId: SHEOLDRED_THE_APOCALYPSE.oracleId,
  name: SHEOLDRED_THE_APOCALYPSE.name,
  triggers: [
    {
      abilityId: 'drawsCard-1',
      text: LINES[1] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Sheoldred, the Apocalypse - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
    {
      abilityId: 'opponentDrawsCard-2',
      text: LINES[2] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      playerOf: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.player : null),
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player !== ctx.query.controllerOf(self),
      label: () => "Sheoldred, the Apocalypse - Target player loses 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L2.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

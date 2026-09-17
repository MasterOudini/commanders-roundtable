// `Vilis, Broker of Blood` - an activation pumpTarget, a youLoseLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VILIS_BROKER_OF_BLOOD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VILIS_BROKER_OF_BLOOD, "Flying\n{B}, Pay 2 life: Target creature gets -1/-1 until end of turn.\nWhenever you lose life, draw that many cards. (Damage causes loss of life.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw that many cards.", VILIS_BROKER_OF_BLOOD.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("Draw that many cards.");

export const VILIS_BROKER_OF_BLOOD_SCRIPT: CardScript = {
  oracleId: VILIS_BROKER_OF_BLOOD.oracleId,
  name: VILIS_BROKER_OF_BLOOD.name,
  activated: [
    {
      ref: `${VILIS_BROKER_OF_BLOOD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youLoseLife-2',
      text: LINES[2] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      memo: (_ctx, _self, ev) => (ev.t === 'LifeChanged' && ev.delta < 0 ? -ev.delta : 0),
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta < 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Vilis, Broker of Blood - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

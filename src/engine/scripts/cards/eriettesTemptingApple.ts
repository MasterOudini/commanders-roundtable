// `Eriette's Tempting Apple` - a etb trigger vocab, an activation gainLife, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ERIETTE_S_TEMPTING_APPLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ERIETTE_S_TEMPTING_APPLE, "When Eriette's Tempting Apple enters, gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.\n{2}, {T}, Sacrifice Eriette's Tempting Apple: You gain 3 life.\n{2}, {T}, Sacrifice Eriette's Tempting Apple: Target opponent loses 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.", ERIETTE_S_TEMPTING_APPLE.name);
const VOCAB_T_L0 = vocabularyTargets("Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.");
const VOCAB_A1 = vocabularyEffects("Target opponent loses 3 life.", ERIETTE_S_TEMPTING_APPLE.name);
const VOCAB_T_A1 = vocabularyTargets("Target opponent loses 3 life.");

export const ERIETTES_TEMPTING_APPLE_SCRIPT: CardScript = {
  oracleId: ERIETTE_S_TEMPTING_APPLE.oracleId,
  name: ERIETTE_S_TEMPTING_APPLE.name,
  activated: [
    {
      ref: `${ERIETTE_S_TEMPTING_APPLE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
    {
      ref: `${ERIETTE_S_TEMPTING_APPLE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Eriette's Tempting Apple - Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

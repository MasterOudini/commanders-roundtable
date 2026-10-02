// `Dina, Soul Steeper` - a youGainLife trigger loseLifeOpponents, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DINA_SOUL_STEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DINA_SOUL_STEEPER, "Whenever you gain life, each opponent loses 1 life.\n{1}, Sacrifice another creature: Dina gets +X/+0 until end of turn, where X is the sacrificed creature's power.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +X/+0 until end of turn, where X is the sacrificed creature's power.", DINA_SOUL_STEEPER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +X/+0 until end of turn, where X is the sacrificed creature's power.");

export const DINA_SOUL_STEEPER_SCRIPT: CardScript = {
  oracleId: DINA_SOUL_STEEPER.oracleId,
  name: DINA_SOUL_STEEPER.name,
  activated: [
    {
      ref: `${DINA_SOUL_STEEPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: LINES[0] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Dina, Soul Steeper - loseLifeOpponents",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
};

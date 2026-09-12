// `Werefox Bodyguard` - a etb trigger vocab, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WEREFOX_BODYGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WEREFOX_BODYGUARD, "Flash\nWhen this creature enters, exile up to one other target non-Fox creature until this creature leaves the battlefield.\n{1}{W}, Sacrifice this creature: You gain 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile up to one other target non-Fox creature until this creature leaves the battlefield.", WEREFOX_BODYGUARD.name);
const VOCAB_T_L1 = vocabularyTargets("Exile up to one other target non-Fox creature until this creature leaves the battlefield.");

export const WEREFOX_BODYGUARD_SCRIPT: CardScript = {
  oracleId: WEREFOX_BODYGUARD.oracleId,
  name: WEREFOX_BODYGUARD.name,
  activated: [
    {
      ref: `${WEREFOX_BODYGUARD.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Werefox Bodyguard - Exile up to one other target non-Fox creature until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};

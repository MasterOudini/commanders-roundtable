// `Touch the Spirit Realm` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOUCH_THE_SPIRIT_REALM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOUCH_THE_SPIRIT_REALM, "When this enchantment enters, exile up to one target artifact or creature until this enchantment leaves the battlefield.\nChannel — {1}{W}, Discard this card: Exile target artifact or creature. Return it to the battlefield under its owner's control at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile up to one target artifact or creature until this enchantment leaves the battlefield.", TOUCH_THE_SPIRIT_REALM.name);
const VOCAB_T_L0 = vocabularyTargets("Exile up to one target artifact or creature until this enchantment leaves the battlefield.");
const VOCAB_A0 = vocabularyEffects("Exile target artifact or creature. Return it to the battlefield under its owner's control at the beginning of the next end step.", TOUCH_THE_SPIRIT_REALM.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target artifact or creature. Return it to the battlefield under its owner's control at the beginning of the next end step.");

export const TOUCH_THE_SPIRIT_REALM_SCRIPT: CardScript = {
  oracleId: TOUCH_THE_SPIRIT_REALM.oracleId,
  name: TOUCH_THE_SPIRIT_REALM.name,
  activated: [
    {
      ref: `${TOUCH_THE_SPIRIT_REALM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
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
      label: () => "Touch the Spirit Realm - Exile up to one target artifact or creature until this enchantment leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

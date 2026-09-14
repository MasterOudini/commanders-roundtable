// `Spirit Bonds` - a creatureEnters trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIRIT_BONDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIRIT_BONDS, "Whenever a nontoken creature you control enters, you may pay {W}. If you do, create a 1/1 white Spirit creature token with flying.\n{1}{W}, Sacrifice a Spirit: Target non-Spirit creature gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may pay {W}. If you do, create a 1/1 white Spirit creature token with flying.", SPIRIT_BONDS.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {W}. If you do, create a 1/1 white Spirit creature token with flying.");
const VOCAB_A0 = vocabularyEffects("Target non-Spirit creature gains indestructible until end of turn.", SPIRIT_BONDS.name);
const VOCAB_T_A0 = vocabularyTargets("Target non-Spirit creature gains indestructible until end of turn.");

export const SPIRIT_BONDS_SCRIPT: CardScript = {
  oracleId: SPIRIT_BONDS.oracleId,
  name: SPIRIT_BONDS.name,
  activated: [
    {
      ref: `${SPIRIT_BONDS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Spirit Bonds - You may pay {W}. If you do, create a 1/1 white Spirit creature token with flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

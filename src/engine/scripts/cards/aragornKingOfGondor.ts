// `Aragorn, King of Gondor` - a etb trigger monarch, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARAGORN_KING_OF_GONDOR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { n, narrated, vb, who } from '../../narrate';

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

const PRINTED = printed(ARAGORN_KING_OF_GONDOR, "Vigilance, lifelink\nWhen Aragorn enters, you become the monarch.\nWhenever Aragorn attacks, up to one target creature can't block this turn. If you're the monarch, creatures can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Up to one target creature can't block this turn. If you're the monarch, creatures can't block this turn.", ARAGORN_KING_OF_GONDOR.name);
const VOCAB_T_L2 = vocabularyTargets("Up to one target creature can't block this turn. If you're the monarch, creatures can't block this turn.");

export const ARAGORN_KING_OF_GONDOR_SCRIPT: CardScript = {
  oracleId: ARAGORN_KING_OF_GONDOR.oracleId,
  name: ARAGORN_KING_OF_GONDOR.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Aragorn, King of Gondor - monarch",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [{ t: 'MonarchChanged', player: obj.controller }, narrated(n`${who(ctx.state, obj.controller)} ${vb(obj.controller, 'becomes', 'become')} the monarch.`, obj.controller)];
      },
    },
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Aragorn, King of Gondor - Up to one target creature can't block this turn. If you're the monarch, creatures can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};

// `Fervent Charge` - a creatureYouControlAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FERVENT_CHARGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FERVENT_CHARGE, "Whenever a creature you control attacks, it gets +2/+2 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature gets +2/+2 until end of turn.", FERVENT_CHARGE.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +2/+2 until end of turn.");

export const FERVENT_CHARGE_SCRIPT: CardScript = {
  oracleId: FERVENT_CHARGE.oracleId,
  name: FERVENT_CHARGE.name,
  triggers: [
    {
      abilityId: 'creatureYouControlAttacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'AttackersDeclared' ? ev.attackers.filter((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)).map((a) => a.card) : []),
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Fervent Charge - Target creature gets +2/+2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

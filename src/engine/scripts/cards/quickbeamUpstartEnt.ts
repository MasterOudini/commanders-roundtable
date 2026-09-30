// `Quickbeam, Upstart Ent` - a etb trigger vocab, a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUICKBEAM_UPSTART_ENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUICKBEAM_UPSTART_ENT, "Whenever Quickbeam or another Treefolk you control enters, up to two target creatures each get +2/+2 and gain trample until end of turn.");

const VOCAB_L0 = vocabularyEffects("Up to two target creatures each get +2/+2 and gain trample until end of turn.", QUICKBEAM_UPSTART_ENT.name);
const VOCAB_T_L0 = vocabularyTargets("Up to two target creatures each get +2/+2 and gain trample until end of turn.");

export const QUICKBEAM_UPSTART_ENT_SCRIPT: CardScript = {
  oracleId: QUICKBEAM_UPSTART_ENT.oracleId,
  name: QUICKBEAM_UPSTART_ENT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Quickbeam, Upstart Ent - Up to two target creatures each get +2/+2 and gain trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Treefolk'),
        ),
      label: () => "Quickbeam, Upstart Ent - Up to two target creatures each get +2/+2 and gain trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

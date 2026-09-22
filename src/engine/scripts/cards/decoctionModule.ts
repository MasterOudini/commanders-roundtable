// `Decoction Module` - a creatureEnters trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DECOCTION_MODULE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DECOCTION_MODULE, "Whenever a creature you control enters, you get {E} (an energy counter).\n{4}, {T}: Return target creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}.", DECOCTION_MODULE.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}.");
const VOCAB_A0 = vocabularyEffects("Return target creature you control to its owner's hand.", DECOCTION_MODULE.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature you control to its owner's hand.");

export const DECOCTION_MODULE_SCRIPT: CardScript = {
  oracleId: DECOCTION_MODULE.oracleId,
  name: DECOCTION_MODULE.name,
  activated: [
    {
      ref: `${DECOCTION_MODULE.oracleId}#a0`,
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
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Decoction Module - You get {E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};

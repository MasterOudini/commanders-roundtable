// `Patron of the Vein` - a etb trigger vocab, a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PATRON_OF_THE_VEIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PATRON_OF_THE_VEIN, "Flying\nWhen this creature enters, destroy target creature an opponent controls.\nWhenever a creature an opponent controls dies, exile it and put a +1/+1 counter on each Vampire you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target creature an opponent controls.", PATRON_OF_THE_VEIN.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target creature an opponent controls.");
const VOCAB_L2 = vocabularyEffects("Exile target creature and put a +1/+1 counter on each Vampire you control.", PATRON_OF_THE_VEIN.name);
const VOCAB_T_L2 = vocabularyTargets("Exile target creature and put a +1/+1 counter on each Vampire you control.");

export const PATRON_OF_THE_VEIN_SCRIPT: CardScript = {
  oracleId: PATRON_OF_THE_VEIN.oracleId,
  name: PATRON_OF_THE_VEIN.name,
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
      label: () => "Patron of the Vein - Destroy target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'aCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      perItem: (ctx, _self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Patron of the Vein - Exile target creature and put a +1/+1 counter on each Vampire you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L2, VOCAB_T_L2, true);
      },
    },
  ],
};

// `Heroes of the Revel` - a etb trigger vocab, a heroic trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEROES_OF_THE_REVEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEROES_OF_THE_REVEL, "When this creature enters, create a 1/1 red Satyr creature token with \"This token can't block.\"\nWhenever you cast a spell that targets this creature, creatures you control get +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a 1/1 red Satyr creature token with \"This token can't block.\"", HEROES_OF_THE_REVEL.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 red Satyr creature token with \"This token can't block.\"");

export const HEROES_OF_THE_REVEL_SCRIPT: CardScript = {
  oracleId: HEROES_OF_THE_REVEL.oracleId,
  name: HEROES_OF_THE_REVEL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Heroes of the Revel - Create a 1/1 red Satyr creature token with \"This token can't block.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Heroes of the Revel - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};

import { describe, expect, it } from 'vitest'
import { parseNutritionText } from './nutritionText'

// Copied from kaloricketabulky.cz on an iPhone, exactly as pasted.
const zinger = `Double zinger KFC
KFC

Zadej množství a jednotku

close
1 g
edit
Zapsat do jídelníčku
246 kcal
Také 1 030 kJ ● Energetická hodnota
fiber_manual_record
Bílkoviny
17 g
Doporučený denní příjem: 118 g
fiber_manual_record
Sacharidy
17 g
Doporučený denní příjem: 182 g
Cukry
2,1 g
fiber_manual_record
Tuky
12 g
Doporučený denní příjem: 53 g
Nasycené mastné kyseliny
2,1 g
Trans mastné kyseliny
-
Mononenasycené
-
Polynenasycené
-
Cholesterol
-
Vláknina
-
Doporučený denní příjem: 28 g
Sůl
1,9 g
Vápník
-
Sodík
-
Voda
-
PHE
850 mg`

const donut = `Donut Oreo Lidl
Zadej množství a jednotku

close
1 g
edit
Zapsat do jídelníčku
477 kcal
Také 1 999 kJ ● Energetická hodnota
fiber_manual_record
Bílkoviny
5,1 g
Doporučený denní příjem: 118 g
fiber_manual_record
Sacharidy
51,6 g
Doporučený denní příjem: 182 g
Cukry
23,6 g
fiber_manual_record
Tuky
27,5 g
Doporučený denní příjem: 53 g
Nasycené mastné kyseliny
14,2 g
Trans mastné kyseliny
-
Mononenasycené
-
Polynenasycené
-
Cholesterol
-
Vláknina
2,3 g
Doporučený denní příjem: 28 g
Sůl
0,06 g
Vápník
-
Sodík
-
Voda
-
PHE
255 mg`

describe('parseNutritionText', () => {
  it('reads a kaloricketabulky.cz page with a brand line', () => {
    expect(parseNutritionText(zinger)).toEqual({
      name: 'Double zinger KFC',
      brand: 'KFC',
      basis: 'g',
      values: { kcal: 246, protein: 17, carbs: 17, sugar: 2.1, fat: 12, salt: 1.9 },
    })
  })

  it('reads a kaloricketabulky.cz page without a brand line, including fiber', () => {
    expect(parseNutritionText(donut)).toEqual({
      name: 'Donut Oreo Lidl',
      brand: null,
      basis: 'g',
      values: { kcal: 477, protein: 5.1, carbs: 51.6, sugar: 23.6, fat: 27.5, fiber: 2.3, salt: 0.06 },
    })
  })

  it('reads a Czech food label with values on the same line, taking the per 100 g column', () => {
    const label = `Výživové údaje na 100 g / porce 50 g
Energetická hodnota 1999 kJ/477 kcal 1000 kJ/239 kcal
Tuky 27,5 g 13,8 g
- z toho nasycené mastné kyseliny 14,2 g 7,1 g
Sacharidy 51,6 g 25,8 g
- z toho cukry 23,6 g 11,8 g
Vláknina 2,3 g 1,2 g
Bílkoviny 5,1 g 2,6 g
Sůl 0,06 g 0,03 g`
    expect(parseNutritionText(label)).toEqual({
      name: null,
      brand: null,
      basis: 'g',
      values: { kcal: 477, protein: 5.1, carbs: 51.6, sugar: 23.6, fat: 27.5, fiber: 2.3, salt: 0.06 },
    })
  })

  it('handles English labels per 100 ml, kJ only and sodium instead of salt', () => {
    const label = `Nutrition per 100ml
Energy 180 kJ
Fat: 0.1 g
Carbohydrate: 10.6 g
of which sugars: 10.6 g
Protein 0
Sodium 40 mg`
    expect(parseNutritionText(label)).toEqual({
      name: null,
      brand: null,
      basis: 'ml',
      values: { kcal: 43, protein: 0, carbs: 10.6, sugar: 10.6, fat: 0.1, salt: 0.1 },
    })
  })

  it('returns null when there is nothing to read', () => {
    expect(parseNutritionText('Double zinger KFC\nKFC')).toBeNull()
    expect(parseNutritionText('')).toBeNull()
  })
})

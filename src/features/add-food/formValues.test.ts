import { describe, expect, it } from 'vitest'
import type { FoodDraft } from '../../api/openFoodFacts'
import { describeFilled, fillEmptyFields, toFormValues } from './formValues'

const eidam: FoodDraft = {
  source: 'off',
  externalId: '8594003240018',
  name: 'Eidam 30 %',
  brand: 'Pilos',
  basis: 'g',
  per100: { kcal: 260, protein: 29, carbs: 0.5, fat: 16, fiber: null, sugar: 0.5, salt: 1.9 },
  defaultServingG: 20,
  defaultServingLabel: '1 slice',
}

describe('toFormValues', () => {
  it('turns a draft into text and an empty form into blanks', () => {
    expect(toFormValues(eidam)).toMatchObject({ name: 'Eidam 30 %', kcal: '260', carbs: '0.5', fiber: '', serving: '20', servingLabel: '1 slice' })
    expect(toFormValues()).toMatchObject({ name: '', kcal: '', basis: 'g', barcode: '' })
  })
})

describe('fillEmptyFields', () => {
  it('fills an empty form completely, including the portion size', () => {
    const { values, filled } = fillEmptyFields(toFormValues(), eidam)
    expect(values).toEqual(toFormValues(eidam))
    expect(filled).toContain('serving')
    expect(filled).toContain('servingLabel')
    expect(filled).toContain('barcode')
  })

  it('keeps what you typed and only fills the blanks', () => {
    const typed = { ...toFormValues(), name: 'My cheese', kcal: '300', serving: '25', servingLabel: 'piece' }
    const { values, filled } = fillEmptyFields(typed, eidam)
    expect(values.name).toBe('My cheese')
    expect(values.kcal).toBe('300')
    expect(values.serving).toBe('25')
    expect(values.servingLabel).toBe('piece')
    expect(values.protein).toBe('29') // was blank
    expect(values.barcode).toBe('8594003240018')
    expect(filled).not.toContain('name')
    expect(filled).not.toContain('kcal')
  })

  it('takes the unit from the product only while no nutrition is entered', () => {
    const milk = { ...eidam, basis: 'ml' as const }
    expect(fillEmptyFields(toFormValues(), milk).values.basis).toBe('ml')
    expect(fillEmptyFields({ ...toFormValues(), kcal: '40' }, milk).values.basis).toBe('g')
  })

  it('sets only the barcode for a product that is not found', () => {
    const typed = { ...toFormValues(), name: 'Homemade bar' }
    const { values, filled } = fillEmptyFields(typed, { externalId: '123456789' })
    expect(values).toEqual({ ...typed, barcode: '123456789' })
    expect(filled).toEqual(['barcode'])
  })

  it('replaces an earlier barcode when you scan a different product', () => {
    const { values } = fillEmptyFields({ ...toFormValues(), barcode: '111111' }, eidam)
    expect(values.barcode).toBe('8594003240018')
  })
})

describe('describeFilled', () => {
  it('lists what was filled in, shortened when long', () => {
    expect(describeFilled(['barcode', 'name', 'kcal'])).toBe('name, energy')
    expect(describeFilled(['barcode'])).toBe('')
    expect(describeFilled(['name', 'brand', 'kcal', 'protein', 'carbs', 'fat'])).toBe('name, brand, energy, protein and 2 more')
  })
})

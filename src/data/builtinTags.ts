/**
 * The built-in tag vocabulary, agreed with the owner (docs/superpowers/specs/2026-11-03-tags-design.md §3.2).
 * Rule of thumb: a tag groups foods you would swap for each other in a meal.
 * Ids are stable and stored on meals and foods; never change an existing id.
 */

export interface BuiltinGroup {
  id: string
  name: string
}

export interface BuiltinTag {
  id: string
  name: string
  groupId: string
}

/** Where tags go when their own group no longer exists. */
export const FALLBACK_GROUP_ID = 'extras'

const LIST: [groupId: string, groupName: string, tags: [id: string, name: string][]][] = [
  ['meat', 'Meat', [
    ['chicken', 'Chicken'], ['turkey', 'Turkey'], ['beef', 'Beef'], ['pork', 'Pork'], ['ham', 'Ham'],
    ['sausage', 'Sausage'], ['bacon', 'Bacon'],
  ]],
  ['fish', 'Fish & seafood', [
    ['salmon', 'Salmon'], ['tuna', 'Tuna'], ['white-fish', 'White fish'], ['shrimp', 'Shrimp'],
  ]],
  ['dairy', 'Eggs & dairy', [
    ['eggs', 'Eggs'], ['milk', 'Milk'], ['quark', 'Quark'], ['skyr', 'Skyr'], ['yogurt', 'Yogurt'],
    ['cottage-cheese', 'Cottage cheese'], ['cheese', 'Cheese'], ['cream', 'Cream'], ['butter', 'Butter'],
  ]],
  ['plant-protein', 'Plant protein', [
    ['lentils', 'Lentils'], ['chickpeas', 'Chickpeas'], ['beans', 'Beans'], ['tofu', 'Tofu'],
  ]],
  ['supplements', 'Supplements', [['protein-powder', 'Protein powder']]],
  ['grains', 'Grains & starches', [
    ['rice', 'Rice'], ['pasta', 'Pasta'], ['noodles', 'Noodles'], ['potatoes', 'Potatoes'],
    ['sweet-potatoes', 'Sweet potatoes'], ['bread', 'Bread'], ['tortilla', 'Tortilla'], ['oats', 'Oats'],
    ['cereal', 'Cereal'], ['quinoa', 'Quinoa'], ['buckwheat', 'Buckwheat'], ['couscous', 'Couscous'], ['flour', 'Flour'],
  ]],
  ['vegetables', 'Vegetables', [
    ['peppers', 'Peppers'], ['tomatoes', 'Tomatoes'], ['cucumber', 'Cucumber'], ['onion', 'Onion'],
    ['garlic', 'Garlic'], ['broccoli', 'Broccoli'], ['cauliflower', 'Cauliflower'], ['leafy-greens', 'Leafy greens'],
    ['lettuce', 'Lettuce'], ['zucchini', 'Zucchini'], ['carrot', 'Carrot'], ['mushrooms', 'Mushrooms'],
    ['cabbage', 'Cabbage'], ['corn', 'Corn'], ['peas', 'Peas'], ['pumpkin', 'Pumpkin'], ['beetroot', 'Beetroot'],
    ['avocado', 'Avocado'], ['mixed-vegetables', 'Mixed vegetables'],
  ]],
  ['fruit', 'Fruit', [
    ['apple', 'Apple'], ['banana', 'Banana'], ['berries', 'Berries'], ['citrus', 'Citrus'],
    ['stone-fruit', 'Stone fruit'], ['tropical-fruit', 'Tropical fruit'], ['grapes', 'Grapes'], ['dried-fruit', 'Dried fruit'],
  ]],
  ['nuts-seeds', 'Nuts & seeds', [['nuts', 'Nuts'], ['peanut-butter', 'Peanut butter'], ['seeds', 'Seeds']]],
  ['extras', 'Extras', [
    ['oil', 'Oil'], ['sauce', 'Sauce'], ['honey-sugar', 'Honey & sugar'], ['chocolate', 'Chocolate'],
    ['sweets', 'Sweets'], ['snacks', 'Snacks'], ['drinks', 'Drinks'], ['fast-food', 'Fast food'],
  ]],
]

export const BUILTIN_GROUPS: BuiltinGroup[] = LIST.map(([id, name]) => ({ id, name }))

export const BUILTIN_TAGS: BuiltinTag[] = LIST.flatMap(([groupId, , tags]) =>
  tags.map(([id, name]) => ({ id, name, groupId })),
)

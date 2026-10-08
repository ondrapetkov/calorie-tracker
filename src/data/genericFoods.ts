import type { Macros } from '../domain/nutrition'

/**
 * Basic (unbranded) foods bundled with the app, so everyday ingredients can be
 * found by their Czech names offline and instantly. Open Food Facts mostly holds
 * packaged products, so it is poor at "kuřecí prsa" or "paprika červená".
 *
 * IMPORTANT: these are approximate reference values per 100 g (or 100 ml), typed
 * from general knowledge of standard food composition tables (mainly USDA
 * FoodData Central). They have NOT been checked line by line against a database.
 * Raw foods are per raw weight; "vařené" entries are per cooked weight. Anything
 * you rely on heavily should be checked against a label or table; a logged food
 * can be edited in the Foods tab.
 */
export interface GenericFood {
  id: string
  name: string
  /** Extra search words: colloquial Czech names and English names. */
  aliases: string
  basis: 'g' | 'ml'
  per100: Macros
  servingG?: number
  servingLabel?: string
}

// kcal, protein, carbs, fat, fiber, sugar, salt
type Row = [number, number, number, number, number | null, number | null, number | null]

function food(
  id: string,
  name: string,
  aliases: string,
  [kcal, protein, carbs, fat, fiber, sugar, salt]: Row,
  extra: { basis?: 'g' | 'ml'; servingG?: number; servingLabel?: string } = {},
): GenericFood {
  return {
    id,
    name,
    aliases,
    basis: extra.basis ?? 'g',
    per100: { kcal, protein, carbs, fat, fiber, sugar, salt },
    servingG: extra.servingG,
    servingLabel: extra.servingLabel,
  }
}

export const GENERIC_FOODS: GenericFood[] = [
  // Meat and fish
  food('chicken-breast-raw', 'Kuřecí prsa bez kůže, syrová', 'kuře kureci prsni rizek chicken breast', [120, 22.5, 0, 2.6, 0, 0, 0.12]),
  food('chicken-breast-cooked', 'Kuřecí prsa bez kůže, vařená/pečená', 'kuře kureci prsni rizek chicken breast cooked grilled', [165, 31, 0, 3.6, 0, 0, 0.19]),
  food('chicken-thigh-raw', 'Kuřecí stehno bez kůže, syrové', 'kuře kureci stehna chicken thigh', [121, 19.7, 0, 4.1, 0, 0, 0.21]),
  food('turkey-breast-raw', 'Krůtí prsa, syrová', 'kruta krutí prsni turkey breast', [114, 23.7, 0, 1.5, 0, 0, 0.11]),
  food('beef-lean-raw', 'Hovězí maso libové, syrové', 'hovezi zadni svickova beef steak', [125, 21.5, 0, 4, 0, 0, 0.17]),
  food('beef-minced-raw', 'Hovězí maso mleté (cca 5 % tuku), syrové', 'hovezi mlete beef ground', [137, 21.4, 0, 5, 0, 0, 0.17]),
  food('pork-tenderloin-raw', 'Vepřová panenka, syrová', 'veprove veprova pork tenderloin', [120, 20.5, 0, 3.5, 0, 0, 0.15]),
  food('pork-loin-raw', 'Vepřová kotleta bez kosti, syrová', 'veprove veprova krkovice karbanatek pork loin', [143, 21, 0, 6, 0, 0, 0.15]),
  food('pork-minced-raw', 'Vepřové maso mleté (cca 20 % tuku), syrové', 'veprove mlete pork ground', [250, 17, 0, 20, 0, 0, 0.17]),
  food('salmon-raw', 'Losos atlantský, syrový', 'losos salmon ryba', [208, 20.4, 0, 13.4, 0, 0, 0.15]),
  food('cod-raw', 'Treska, syrová', 'treska cod ryba', [82, 17.8, 0, 0.7, 0, 0, 0.14]),
  food('tuna-canned-water', 'Tuňák ve vlastní šťávě, konzerva, odkapaný', 'tunak tuna konzerva', [116, 25.5, 0, 0.8, 0, 0, 0.62]),
  food('shrimp-raw', 'Krevety, syrové', 'kreveta shrimp prawn', [85, 20.1, 0.2, 0.5, 0, 0, 0.3]),

  // Eggs and dairy
  food('egg-whole', 'Vejce slepičí, celé', 'vejce vajicko egg', [143, 12.6, 0.7, 9.5, 0, 0.4, 0.36], { servingG: 50, servingLabel: '1 vejce (M)' }),
  food('egg-white', 'Vaječný bílek', 'bilek egg white', [52, 10.9, 0.7, 0.2, 0, 0.7, 0.42], { servingG: 33, servingLabel: '1 bílek' }),
  food('egg-yolk', 'Vaječný žloutek', 'zloutek egg yolk', [322, 15.9, 3.6, 26.5, 0, 0.6, 0.12], { servingG: 17, servingLabel: '1 žloutek' }),
  food('milk-whole', 'Mléko plnotučné (3,5 %)', 'mleko plnotucne milk', [64, 3.3, 4.7, 3.5, 0, 4.7, 0.1], { basis: 'ml' }),
  food('milk-semi', 'Mléko polotučné (1,5 %)', 'mleko polotucne milk', [46, 3.4, 4.8, 1.5, 0, 4.8, 0.1], { basis: 'ml' }),
  food('milk-skim', 'Mléko odtučněné', 'mleko odtucnene nizkotucne milk skim', [34, 3.4, 4.9, 0.1, 0, 4.9, 0.1], { basis: 'ml' }),
  food('quark-skim', 'Tvaroh odtučněný', 'tvaroh quark nizkotucny', [70, 12.5, 4, 0.5, 0, 3.8, 0.1]),
  food('quark-semi', 'Tvaroh polotučný', 'tvaroh quark', [105, 11.5, 3.5, 4.5, 0, 3.4, 0.1]),
  food('skyr', 'Skyr, bílý', 'skyr jogurt islandsky', [63, 11, 4, 0.2, 0, 4, 0.1]),
  food('cottage-cheese', 'Cottage sýr (zrnitý tvaroh)', 'cottage zrnity tvaroh', [98, 11.1, 3.4, 4.3, 0, 2.7, 0.9]),
  food('greek-yogurt-0', 'Řecký jogurt 0 % tuku', 'recky jogurt greek yogurt', [59, 10.2, 3.6, 0.4, 0, 3.2, 0.09]),
  food('yogurt-plain', 'Bílý jogurt (cca 3,5 % tuku)', 'bily jogurt smetanovy yogurt', [61, 3.5, 4.7, 3.3, 0, 4.7, 0.12]),
  food('butter', 'Máslo 82 %', 'maslo butter', [744, 0.7, 0.7, 82, 0, 0.7, 0.02]),

  // Grains, bread, potatoes
  food('oats-rolled', 'Ovesné vločky, suché', 'ovesne vlocky ovesna kase oats oatmeal', [379, 13.2, 67.7, 6.5, 10.1, 1, 0.02]),
  food('rice-white-raw', 'Rýže bílá, syrová', 'ryze rice', [365, 7.1, 80, 0.7, 1.3, 0.1, 0.01]),
  food('rice-white-cooked', 'Rýže bílá, vařená', 'ryze rice cooked', [130, 2.7, 28.2, 0.3, 0.4, 0, 0.01]),
  food('pasta-dry', 'Těstoviny, suché', 'testoviny spagety penne makarony pasta', [371, 13, 74.7, 1.5, 3.2, 2.7, 0.02]),
  food('pasta-cooked', 'Těstoviny, vařené', 'testoviny spagety penne makarony pasta cooked', [158, 5.8, 30.9, 0.9, 1.8, 0.6, 0.01]),
  food('potato-raw', 'Brambory, syrové', 'brambor potato', [77, 2, 17.5, 0.1, 2.1, 0.8, 0.02]),
  food('potato-boiled', 'Brambory vařené', 'brambor potato boiled', [87, 1.9, 20.1, 0.1, 1.8, 0.9, 0.01]),
  food('sweet-potato-raw', 'Batáty (sladké brambory), syrové', 'bataty sladke brambory sweet potato', [86, 1.6, 20.1, 0.1, 3, 4.2, 0.14]),
  food('bread-rye-wheat', 'Chléb konzumní (žitno-pšeničný)', 'chleb konzumni zitny bread', [240, 7.5, 47, 1.2, 4, 2.5, 1.3]),
  food('bread-roll', 'Rohlík', 'rohlik houska pecivo bread roll', [285, 9, 55, 2.5, 3, 2.5, 1.5], { servingG: 43, servingLabel: '1 rohlík' }),
  food('quinoa-raw', 'Quinoa, suchá', 'quinoa kinoa', [368, 14.1, 64.2, 6.1, 7, null, 0.01]),
  food('buckwheat-raw', 'Pohanka, suchá', 'pohanka buckwheat', [343, 13.3, 71.5, 3.4, 10, null, 0.01]),
  food('couscous-dry', 'Kuskus, suchý', 'kuskus couscous', [376, 12.8, 77.4, 0.6, 5, null, 0.02]),
  food('flour-wheat', 'Mouka pšeničná hladká', 'mouka psenicna wheat flour', [364, 10.3, 76.3, 1, 2.7, 0.3, 0.01]),

  // Legumes
  food('lentils-raw', 'Čočka, suchá', 'cocka lentils', [352, 24.6, 63.4, 1.1, 10.7, 2, 0.02]),
  food('chickpeas-raw', 'Cizrna, suchá', 'cizrna chickpeas', [378, 20.5, 62.9, 6, 12.2, 10.7, 0.06]),
  food('chickpeas-canned', 'Cizrna, konzerva, odkapaná', 'cizrna chickpeas konzervovana', [139, 7, 22.5, 2.8, 6.4, null, 0.6]),

  // Vegetables
  food('pepper-red', 'Paprika červená, syrová', 'paprika cervena pepper bell red', [31, 1, 6, 0.3, 2.1, 4.2, 0.01]),
  food('pepper-green', 'Paprika zelená, syrová', 'paprika zelena pepper bell green', [20, 0.9, 4.6, 0.2, 1.7, 2.4, 0.01]),
  food('pepper-yellow', 'Paprika žlutá, syrová', 'paprika zluta pepper bell yellow', [27, 1, 6.3, 0.2, 0.9, null, 0.01]),
  food('tomato', 'Rajče', 'rajce rajcata paradajka tomato', [18, 0.9, 3.9, 0.2, 1.2, 2.6, 0.01]),
  food('cucumber', 'Okurka salátová', 'okurka salatova cucumber', [15, 0.7, 3.6, 0.1, 0.5, 1.7, 0.01]),
  food('carrot', 'Mrkev', 'mrkev carrot', [41, 0.9, 9.6, 0.2, 2.8, 4.7, 0.17]),
  food('onion', 'Cibule', 'cibule onion', [40, 1.1, 9.3, 0.1, 1.7, 4.2, 0.01]),
  food('garlic', 'Česnek', 'cesnek garlic', [149, 6.4, 33.1, 0.5, 2.1, 1, 0.04]),
  food('broccoli', 'Brokolice', 'brokolice broccoli', [34, 2.8, 6.6, 0.4, 2.6, 1.7, 0.08]),
  food('cauliflower', 'Květák', 'kvetak cauliflower', [25, 1.9, 5, 0.3, 2, 1.9, 0.08]),
  food('spinach', 'Špenát', 'spenat spinach', [23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.2]),
  food('zucchini', 'Cuketa', 'cuketa zucchini', [17, 1.2, 3.1, 0.3, 1, 2.5, 0.02]),
  food('lettuce-iceberg', 'Salát ledový', 'salat ledovy lettuce iceberg', [14, 0.9, 3, 0.1, 1.2, 1.8, 0.03]),
  food('cabbage-white', 'Zelí bílé', 'zeli bile cabbage', [25, 1.3, 5.8, 0.1, 2.5, 3.2, 0.05]),
  food('mushrooms-button', 'Žampiony', 'zampion houby mushroom champignon', [22, 3.1, 3.3, 0.3, 1, 2, 0.01]),
  food('eggplant', 'Lilek', 'lilek patlizan eggplant aubergine', [25, 1, 5.9, 0.2, 3, 3.5, 0.01]),
  food('celeriac', 'Celer bulva', 'celer bulvovy celeriac', [42, 1.5, 9.2, 0.3, 1.8, 1.6, 0.25]),
  food('radish', 'Ředkvička', 'redkvicka redkev radish', [16, 0.7, 3.4, 0.1, 1.6, 1.9, 0.1]),
  food('avocado', 'Avokádo', 'avokado avocado', [160, 2, 8.5, 14.7, 6.7, 0.7, 0.02]),
  food('pumpkin-butternut', 'Dýně máslová, syrová', 'dyne butternut hokkaido pumpkin squash', [45, 1, 11.7, 0.1, 2, 2.2, 0.01]),
  food('beetroot', 'Červená řepa, syrová', 'cervena repa beetroot beet', [43, 1.6, 9.6, 0.2, 2.8, 6.8, 0.2]),

  // Fruit
  food('apple', 'Jablko', 'jablko apple', [52, 0.3, 13.8, 0.2, 2.4, 10.4, 0.01], { servingG: 180, servingLabel: '1 jablko (střední)' }),
  food('banana', 'Banán', 'banan banana', [89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.01], { servingG: 120, servingLabel: '1 banán (střední, bez slupky)' }),
  food('orange', 'Pomeranč', 'pomeranc orange', [47, 0.9, 11.8, 0.1, 2.4, 9.4, 0.01]),
  food('mandarin', 'Mandarinka', 'mandarinka mandarin clementine', [53, 0.8, 13.3, 0.3, 1.8, 10.6, 0.01]),
  food('pear', 'Hruška', 'hruska pear', [57, 0.4, 15.2, 0.1, 3.1, 9.8, 0.01]),
  food('peach', 'Broskev', 'broskev peach', [39, 0.9, 9.5, 0.3, 1.5, 8.4, 0.01]),
  food('strawberries', 'Jahody', 'jahoda jahody strawberry', [32, 0.7, 7.7, 0.3, 2, 4.9, 0.01]),
  food('blueberries', 'Borůvky', 'boruvka boruvky blueberry', [57, 0.7, 14.5, 0.3, 2.4, 10, 0.01]),
  food('raspberries', 'Maliny', 'malina maliny raspberry', [52, 1.2, 11.9, 0.7, 6.5, 4.4, 0.01]),
  food('grapes', 'Hroznové víno (hrozny)', 'hrozny hrozno vino grapes', [69, 0.7, 18.1, 0.2, 0.9, 15.5, 0.01]),
  food('kiwi', 'Kiwi', 'kiwi', [61, 1.1, 14.7, 0.5, 3, 9, 0.01]),
  food('pineapple', 'Ananas', 'ananas pineapple', [50, 0.5, 13.1, 0.1, 1.4, 9.9, 0.01]),
  food('watermelon', 'Meloun vodní', 'meloun vodni watermelon', [30, 0.6, 7.6, 0.2, 0.4, 6.2, 0.01]),
  food('dates-dried', 'Datle sušené', 'datle datlove dates', [277, 1.8, 75, 0.2, 6.7, 66.5, 0.01]),
  food('raisins', 'Rozinky', 'rozinky raisins', [299, 3.1, 79.2, 0.5, 3.7, 59.2, 0.03]),

  // Nuts, seeds, fats, sweet
  food('almonds', 'Mandle', 'mandle almonds orechy', [579, 21.2, 21.6, 49.9, 12.5, 4.4, 0.01]),
  food('walnuts', 'Vlašské ořechy', 'vlasske orechy walnuts', [654, 15.2, 13.7, 65.2, 6.7, 2.6, 0.01]),
  food('cashews', 'Kešu ořechy', 'kesu orechy cashews', [553, 18.2, 30.2, 43.9, 3.3, 5.9, 0.01]),
  food('peanuts-roasted', 'Arašídy pražené, nesolené', 'arasidy peanuts orechy', [585, 23.7, 21.5, 49.7, 8, 4.2, 0.01]),
  food('chia', 'Chia semínka', 'chia seminka seeds', [486, 16.5, 42.1, 30.7, 34.4, null, 0.04]),
  food('flaxseed', 'Lněné semínko', 'lnene seminko flax linseed', [534, 18.3, 28.9, 42.2, 27.3, 1.6, 0.08]),
  food('pumpkin-seeds', 'Dýňová semínka, loupaná', 'dynova seminka pumpkin seeds', [559, 30.2, 10.7, 49.1, 6, 1.4, 0.02]),
  food('sunflower-seeds', 'Slunečnicová semínka, loupaná', 'slunecnicova seminka sunflower seeds', [584, 20.8, 20, 51.5, 8.6, 2.6, 0.02]),
  food('olive-oil', 'Olivový olej', 'olivovy olej olive oil', [884, 0, 0, 100, 0, 0, 0], { servingG: 13.5, servingLabel: '1 lžíce' }),
  food('rapeseed-oil', 'Řepkový olej', 'repkovy olej rapeseed canola oil', [884, 0, 0, 100, 0, 0, 0], { servingG: 13.5, servingLabel: '1 lžíce' }),
  food('honey', 'Med', 'med honey', [304, 0.3, 82.4, 0, 0.2, 82.1, 0]),
  food('sugar', 'Cukr bílý', 'cukr sugar', [387, 0, 100, 0, 0, 99.8, 0]),
  food('chocolate-dark', 'Hořká čokoláda (70–85 % kakaa)', 'horka cokolada dark chocolate', [598, 7.8, 45.9, 42.6, 10.9, 24, 0.03]),
]

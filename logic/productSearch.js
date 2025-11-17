// logic/productSearch.js
// منطق اختيار أفضل 3 منتجات (أرخص / أفضل قيمة / أعلى جودة)

const { PRODUCTS, filterProducts } = require("../data/products");

/**
 * اختيار منتج حسب qualityTier معيّن
 * tiers: "budget" | "value" | "premium"
 */
function pickByTier(products, tier) {
  if (!products || !products.length) return null;
  return products.find((p) => p.qualityTier === tier) || null;
}

/**
 * اختيار أفضل 3 منتجات:
 * - cheapest   => أرخص خيار (عادة من tier "budget" أو الأقل سعرًا)
 * - bestValue  => أفضل قيمة مقابل السعر (عادة من tier "value")
 * - premium    => أعلى جودة (عادة من tier "premium" أو الأغلى)
 *
 * filters:
 *  - category   (مثال: "safety")
 *  - itemType   (مثال: "helmet-fullface")
 *  - usage      (مثال: "touring" | "city" | "adventure")
 *  - bikeType   (مثال: "sport" | "cruiser" | "scooter" | "adventure")
 */
function selectTop3Products(filters = {}) {
  const candidates = filterProducts(filters);

  if (!candidates.length) {
    return {
      items: [],
      totalMatched: 0,
      filtersApplied: filters,
    };
  }

  // ترتيب عام حسب السعر (من الأقل للأعلى)
  const sortedByPrice = [...candidates].sort(
    (a, b) => (a.priceUSD || 0) - (b.priceUSD || 0)
  );

  // محاولة اختيار حسب الـ tier أولاً
  let cheapest = pickByTier(candidates, "budget") || sortedByPrice[0];
  let bestValue =
    pickByTier(candidates, "value") ||
    sortedByPrice[Math.min(1, sortedByPrice.length - 1)];
  let premium =
    pickByTier(candidates, "premium") ||
    sortedByPrice[sortedByPrice.length - 1];

  // ضمان عدم تكرار نفس المنتج في أكثر من فئة
  const picked = [];
  function addIfNotDuplicate(label, product) {
    if (!product) return;
    if (picked.some((p) => p.product.id === product.id)) return;
    picked.push({ label, product });
  }

  addIfNotDuplicate("cheapest", cheapest);
  addIfNotDuplicate("best_value", bestValue);
  addIfNotDuplicate("premium", premium);

  return {
    items: picked,
    totalMatched: candidates.length,
    filtersApplied: filters,
  };
}

module.exports = {
  selectTop3Products,
};

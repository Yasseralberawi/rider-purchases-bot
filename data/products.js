// data/products.js
// قاعدة بيانات داخلية مبسّطة لرايدر المشتريات
// ملاحظة: التركيز الآن على الخوذ (Full Face Touring) كنقطة بداية

// qualityTier:
// - "budget"  = أرخص خيار
// - "value"   = أفضل قيمة مقابل السعر
// - "premium" = أعلى جودة

const PRODUCTS = [
  // =========================
  // خوذ Full Face - استخدام Touring / Highway
  // =========================
  {
    id: "helmet-ls2-ff353-rapid",
    category: "safety",
    itemType: "helmet-fullface",
    brand: "LS2",
    name: "LS2 FF353 Rapid",
    description: "خوذة فل فيس خفيفة ومناسبة للمبتدئين، تهوية جيدة وسعر اقتصادي.",
    qualityTier: "budget",
    usageTags: ["touring", "city"],
    bikeTypeTags: ["sport", "scooter", "cruiser"],
    priceUSD: 95,
    currency: "USD",
    store: "Amazon",
    storeType: "global",
    url: "https://www.amazon.com",
    image: "https://images.ls2.com/ff353-rapid.jpg",
    notes: "من الخوذ الاقتصادية المشهورة، مناسبة للمشوار اليومي والسفر القصير."
  },
  {
    id: "helmet-hjc-c70",
    category: "safety",
    itemType: "helmet-fullface",
    brand: "HJC",
    name: "HJC C70",
    description: "خوذة فل فيس مع نظارة داخلية، توازن ممتاز بين السعر والمواصفات.",
    qualityTier: "value",
    usageTags: ["touring", "city", "highway"],
    bikeTypeTags: ["sport", "cruiser", "scooter"],
    priceUSD: 180,
    currency: "USD",
    store: "FC-Moto",
    storeType: "global",
    url: "https://www.fc-moto.de",
    image: "https://images.hjchelmets.com/c70.jpg",
    notes: "خيار قوي كأفضل قيمة مقابل سعر، مناسب للسفر داخل وخارج المدينة."
  },
  {
    id: "helmet-shoei-gt-air-2",
    category: "safety",
    itemType: "helmet-fullface",
    brand: "Shoei",
    name: "Shoei GT-Air II",
    description: "خوذة فل فيس فاخرة، مريحة لمسافات طويلة مع عزل صوت ممتاز.",
    qualityTier: "premium",
    usageTags: ["touring", "highway"],
    bikeTypeTags: ["sport", "cruiser", "adventure"],
    priceUSD: 550,
    currency: "USD",
    store: "RevZilla",
    storeType: "global",
    url: "https://www.revzilla.com",
    image: "https://images.shoei-helmets.com/gt-air-2.jpg",
    notes: "مناسبة للدراجين اللي يهتمّون بالراحة العالية في السفر لمسافات طويلة."
  },

  // =========================
  // خوذ Full Face - تركيز مدينة / يومي
  // =========================
  {
    id: "helmet-agv-k1",
    category: "safety",
    itemType: "helmet-fullface",
    brand: "AGV",
    name: "AGV K1",
    description: "خوذة فل فيس رياضية بطابع سبورت، جيدة للمدينة والهاي وي.",
    qualityTier: "value",
    usageTags: ["city", "touring"],
    bikeTypeTags: ["sport"],
    priceUSD: 210,
    currency: "USD",
    store: "Amazon",
    storeType: "global",
    url: "https://www.amazon.com",
    image: "https://images.agv.com/k1.jpg",
    notes: "مناسبة لملاك الدراجات السبورت خصوصاً في الاستخدام اليومي."
  },
  {
    id: "helmet-ls2-storm-ff800",
    category: "safety",
    itemType: "helmet-fullface",
    brand: "LS2",
    name: "LS2 FF800 Storm",
    description: "خوذة فل فيس touring بمواصفات جيدة وسعر متوسط.",
    qualityTier: "value",
    usageTags: ["touring", "city", "highway"],
    bikeTypeTags: ["sport", "cruiser", "scooter"],
    priceUSD: 160,
    currency: "USD",
    store: "FC-Moto",
    storeType: "global",
    url: "https://www.fc-moto.de",
    image: "https://images.ls2.com/ff800-storm.jpg",
    notes: "خيار متوازن كأفضل قيمة مقابل السعر لرحلات touring المتوسطة."
  },

  // =========================
  // خوذ مناسبة أكثر لأدفنشر / أوف رود (لكن ما زالت فل فيس طريق)
  // =========================
  {
    id: "helmet-icon-airflite",
    category: "safety",
    itemType: "helmet-fullface",
    brand: "Icon",
    name: "Icon Airflite",
    description: "خوذة فل فيس بتصميم هجومي، مناسبة للهايبريد بين المدينة والهاي وي.",
    qualityTier: "value",
    usageTags: ["touring", "city", "highway"],
    bikeTypeTags: ["sport", "adventure", "cruiser"],
    priceUSD: 260,
    currency: "USD",
    store: "RevZilla",
    storeType: "global",
    url: "https://www.revzilla.com",
    image: "https://images.iconhelmets.com/airflite.jpg",
    notes: "تناسب من يحب الشكل المميز مع جودة متوسطة إلى عالية."
  }
];

/**
 * دالة بسيطة لتصفية المنتجات حسب نوع الطلب
 * لاحقاً سنستخدم هذه الدالة داخل منطق البحث في البوت.
 *
 * filters:
 *  - category   (مثال: "safety")
 *  - itemType   (مثال: "helmet-fullface")
 *  - usage      (مثال: "touring" | "city" | "adventure")
 *  - bikeType   (مثال: "sport" | "cruiser" | "scooter" | "adventure")
 */
function filterProducts(filters = {}) {
  const { category, itemType, usage, bikeType } = filters;

  return PRODUCTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (itemType && p.itemType !== itemType) return false;
    if (usage && p.usageTags && !p.usageTags.includes(usage)) return false;
    if (bikeType && p.bikeTypeTags && !p.bikeTypeTags.includes(bikeType))
      return false;
    return true;
  });
}

module.exports = {
  PRODUCTS,
  filterProducts,
};

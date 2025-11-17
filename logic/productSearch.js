// ============================================================
//  Rider Purchases Bot – Product Search Logic (Full File)
// ============================================================

// Helper: Amazon search URL with affiliate tag
function buildAmazonSearchUrl(query) {
  const tag = process.env.AMAZON_ASSOCIATE_TAG || "";
  const encoded = encodeURIComponent(query.trim());
  let url = `https://www.amazon.com/s?k=${encoded}`;
  if (tag) url += `&tag=${tag}`;
  return url;
}

// ============================================================
// 🟧 1) Helmet Logic (Full-Face, Modular, Half)
// ============================================================

function buildHelmetQuery(context) {
  const usage = context.usage || "";
  const bikeType = context.bikeType || "";
  const category = "helmet-fullface";

  let q = `motorcycle full face helmet ${usage} ${bikeType}`;

  return {
    query: q.trim(),
    url: buildAmazonSearchUrl(q),
    category,
    results: [
      {
        label: "cheapest",
        id: "helmet-ls2-ff353-rapid",
        name: "LS2 FF353 Rapid",
        brand: "LS2",
        store: "Amazon",
        priceUSD: 95,
        currency: "USD",
        url: "https://www.amazon.com",
        qualityTier: "budget",
      },
      {
        label: "best_value",
        id: "helmet-hjc-c70",
        name: "HJC C70",
        brand: "HJC",
        store: "FC-Moto",
        priceUSD: 180,
        currency: "USD",
        url: "https://www.fc-moto.de",
        qualityTier: "value",
      },
      {
        label: "premium",
        id: "helmet-shoei-gt-air-2",
        name: "Shoei GT-Air II",
        brand: "Shoei",
        store: "RevZilla",
        priceUSD: 550,
        currency: "USD",
        url: "https://www.revzilla.com",
        qualityTier: "premium",
      },
    ],
  };
}

// ============================================================
// 🧥 2) Jacket Logic (Riding Jacket)
// ============================================================

function buildJacketQuery(context) {
  const usage = context.usage || "";
  const bikeType = context.bikeType || "";
  const category = "jacket";

  let q = `motorcycle jacket ${usage} ${bikeType}`;

  return {
    query: q.trim(),
    url: buildAmazonSearchUrl(q),
    category,
    results: [
      {
        label: "best_value",
        id: "jacket-hwk-adv",
        name: "HWK Adventure/Touring Jacket",
        brand: "HWK",
        store: "Amazon",
        priceUSD: 89,
        currency: "USD",
        url: "https://www.amazon.com",
        qualityTier: "value",
      },
      {
        label: "premium",
        id: "jacket-alpinestars-t-gp-plus",
        name: "Alpinestars T-GP Plus R v3",
        brand: "Alpinestars",
        store: "RevZilla",
        priceUSD: 299,
        currency: "USD",
        url: "https://www.revzilla.com",
        qualityTier: "premium",
      },
      {
        label: "budget",
        id: "jacket-borasco",
        name: "BORASCO Basic Riding Jacket",
        brand: "Borasco",
        store: "Amazon",
        priceUSD: 59,
        currency: "USD",
        url: "https://www.amazon.com",
        qualityTier: "budget",
      },
    ],
  };
}

// ============================================================
– 🔍 3) Main Router – Detect Category
// ============================================================

function detectProductCategory(message) {
  message = message.toLowerCase();

  // Helmets
  if (
    message.includes("خوذة") ||
    message.includes("خودة") ||
    message.includes("helmet") ||
    message.includes("فل فيس") ||
    message.includes("full face")
  ) {
    return "helmet-fullface";
  }

  // Jackets
  if (
    message.includes("جاكيت") ||
    message.includes("jacket") ||
    message.includes("جاكيت حماية") ||
    message.includes("jackets")
  ) {
    return "jacket";
  }

  return null;
}

// ============================================================
// 🚀 Exported Search Entry
// ============================================================

function searchProducts(context) {
  const cat = context.category;

  if (cat === "helmet-fullface") {
    return buildHelmetQuery(context);
  }

  if (cat === "jacket") {
    return buildJacketQuery(context);
  }

  return null;
}

module.exports = {
  detectProductCategory,
  searchProducts,
  buildAmazonSearchUrl,
};

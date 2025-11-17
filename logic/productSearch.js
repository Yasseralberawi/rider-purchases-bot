// ============================================================
//  Rider Purchases Bot – Product Search Logic (Full File)
//  Helmets + Jackets + Gloves + Boots + Accessories (NEW)
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
// 🪖 1) Helmet Logic (Full-Face, Modular, Half)
// ============================================================

function buildHelmetQuery(context) {
  const usage = context.usage || "";
  const bikeType = context.bikeType || "";
  const category = "helmet-fullface";

  const q = `motorcycle full face helmet ${usage} ${bikeType}`;

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

  const q = `motorcycle jacket ${usage} ${bikeType}`;

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
// 🧤 3) Gloves Logic (Riding Gloves)
// ============================================================

function buildGlovesQuery(context) {
  const usage = context.usage || "";
  const bikeType = context.bikeType || "";
  const category = "gloves";

  const q = `motorcycle riding gloves ${usage} ${bikeType}`;

  return {
    query: q.trim(),
    url: buildAmazonSearchUrl(q),
    category,
    results: [
      {
        label: "budget",
        id: "gloves-budget-basic",
        name: "Motorcycle Protective Gloves Basic",
        brand: "Generic",
        store: "Amazon",
        priceUSD: 35,
        currency: "USD",
        url: "https://www.amazon.com",
        qualityTier: "budget",
      },
      {
        label: "best_value",
        id: "gloves-alpinestars-sp2",
        name: "Alpinestars SP-2 V3 Gloves",
        brand: "Alpinestars",
        store: "RevZilla",
        priceUSD: 130,
        currency: "USD",
        url: "https://www.revzilla.com",
        qualityTier: "value",
      },
      {
        label: "premium",
        id: "gloves-dainese-carbon",
        name: "Dainese Carbon D1 Long Gloves",
        brand: "Dainese",
        store: "RevZilla",
        priceUSD: 220,
        currency: "USD",
        url: "https://www.revzilla.com",
        qualityTier: "premium",
      },
    ],
  };
}

// ============================================================
// 🥾 4) Boots Logic (Riding Boots)
// ============================================================

function buildBootsQuery(context) {
  const usage = context.usage || "";
  const bikeType = context.bikeType || "";
  const category = "boots";

  const q = `motorcycle riding boots ${usage} ${bikeType}`;

  return {
    query: q.trim(),
    url: buildAmazonSearchUrl(q),
    category,
    results: [
      {
        label: "budget",
        id: "boots-budget-basic",
        name: "Entry-Level Motorcycle Riding Boots",
        brand: "Generic",
        store: "Amazon",
        priceUSD: 85,
        currency: "USD",
        url: "https://www.amazon.com",
        qualityTier: "budget",
      },
      {
        label: "best_value",
        id: "boots-forma-adventure",
        name: "Forma Adventure Boots",
        brand: "Forma",
        store: "FC-Moto",
        priceUSD: 279,
        currency: "USD",
        url: "https://www.fc-moto.de",
        qualityTier: "value",
      },
      {
        label: "premium",
        id: "boots-alpinestars-tech7",
        name: "Alpinestars Tech 7 Enduro Boots",
        brand: "Alpinestars",
        store: "RevZilla",
        priceUSD: 430,
        currency: "USD",
        url: "https://www.revzilla.com",
        qualityTier: "premium",
      },
    ],
  };
}

// ============================================================
// 🎒 5) Accessories Logic (NEW)
// ============================================================

// Detect from message if user wants accessories
function detectAccessoryCategory(message) {
  message = (message || "").toLowerCase();

  if (
    message.includes("اكسسوار") ||
    message.includes("إكسسوار") ||
    message.includes("شنطة") ||
    message.includes("حامل") ||
    message.includes("cover") ||
    message.includes("windshield") ||
    message.includes("crash") ||
    message.includes("usb") ||
    message.includes("حماية") ||
    message.includes("اكسسوارات") ||
    message.includes("accessory") ||
    message.includes("accessories")
  ) {
    return "accessory";
  }

  return null;
}

function buildAccessoryQuery(context) {
  const type = context.accessoryType || "motorcycle accessory";
  const bikeType = context.bikeType || "";
  const usage = context.usage || "";

  const q = `motorcycle ${type} ${usage} ${bikeType}`;

  return {
    query: q.trim(),
    url: buildAmazonSearchUrl(q),
    category: "accessory",
    results: [],
  };
}

// ============================================================
// 🔍 6) Main Router – Detect Product Category
// ============================================================

function detectProductCategory(message) {
  message = (message || "").toLowerCase();

  // Accessories (NEW)
  const acc = detectAccessoryCategory(message);
  if (acc) return acc;

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

  // Gloves
  if (
    message.includes("قفازات") ||
    message.includes("قلفز") ||
    message.includes("gloves")
  ) {
    return "gloves";
  }

  // Boots
  if (
    message.includes("بوت") ||
    message.includes("جزمة") ||
    message.includes("boots")
  ) {
    return "boots";
  }

  return null;
}

// ============================================================
// 🚀 7) Exported Search Entry
// ============================================================

function searchProducts(context) {
  const cat = context.category;

  if (cat === "helmet-fullface") {
    return buildHelmetQuery(context);
  }

  if (cat === "jacket") {
    return buildJacketQuery(context);
  }

  if (cat === "gloves") {
    return buildGlovesQuery(context);
  }

  if (cat === "boots") {
    return buildBootsQuery(context);
  }

  if (cat === "accessory") {
    return buildAccessoryQuery(context);
  }

  return null;
}

module.exports = {
  detectProductCategory,
  searchProducts,
  buildAmazonSearchUrl,
};

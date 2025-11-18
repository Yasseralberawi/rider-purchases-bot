// server.js
// Backend مستقل - بوت رايدر المشتريات (نسخة V2)
// MongoDB + ملف مشتريات لكل عميل + أسئلة محترفة + رابط بحث Amazon مخصص

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

// خدمة بناء رابط بحث Amazon حسب السياق (تستخدم الـ Affiliate Tag)
const {
  buildAmazonSearchLinkFromContext,
} = require("./services/amazonSearch");

const app = express();

// إعدادات أساسية
const PORT = process.env.PORT || 5050;

// ==============================
// اتصال MongoDB
// ==============================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn(
    "⚠️ MONGODB_URI غير موجود في المتغيرات البيئية. الاتصال بقاعدة البيانات لن يعمل."
  );
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("✅ متصل بقاعدة بيانات MongoDB بنجاح (رايدر المشتريات).");
    })
    .catch((err) => {
      console.error(
        "❌ فشل الاتصال بـ MongoDB في رايدر المشتريات:",
        err.message
      );
    });
}

// ==============================
// تعريف نموذج ملف مشتريات العميل
// ==============================
const purchaseProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    // آخر تفضيلات معروفة (للتسجيل فقط، مش لاستخدامها قسرياً في الردود)
    preferredBikeType: { type: String, default: null }, // sport / cruiser / scooter / adventure
    lastUsage: { type: String, default: null }, // city / touring / adventure

    lastCategory: { type: String, default: null }, // safety / spare-part / accessory
    lastItemType: { type: String, default: null }, // helmet-fullface / jacket / gloves / boots / spare-part / accessory

    lastBikeBrand: { type: String, default: null },
    lastBikeModel: { type: String, default: null },
    lastBikeYear: { type: String, default: null },

    lastPartName: { type: String, default: null }, // اسم قطعة الغيار إن وجد

    // تاريخ بسيط للمحادثات
    history: [
      {
        message: { type: String },
        reply: { type: String },
        category: { type: String },
        itemType: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const PurchaseProfile =
  mongoose.models.PurchaseProfile ||
  mongoose.model("PurchaseProfile", purchaseProfileSchema);

// ===== Middlewares أساسية =====
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: "*", // لاحقاً ممكن نحدده على دومين Rider Mall
  })
);
app.use(helmet());
app.use(morgan("dev"));

/* =====================================
   دوال مساعدة للترجمة والملصقات
   ===================================== */

function T(lang = "ar") {
  const isAr = lang === "ar";

  return {
    botName: isAr ? "رايدر المشتريات" : "Rider Purchases",
    welcomeLine: isAr
      ? "أهلاً بك، أنا رايدر المشتريات 👋"
      : "Hi, I'm Rider Purchases 👋",
    genericIntro: isAr
      ? "شغلي أساعدك تختار المنتج الأنسب وأضبط لك رابط بحث جاهز على Amazon حسب طلبك."
      : "My job is to help you choose the right product and build a tailored Amazon search link for you.",
    // شرح أسلوب المستشار
    proSafetyAsk: isAr
      ? "عشان أقدر أساعدك كمستشار معدات سلامة، اكتب لي في *رسالة واحدة* التفاصيل التالية:\n1) نوع القطعة (خوذة فل فيس / جاكيت / قفازات / بوت)\n2) نوع الاستخدام (مدينة / سفر / أدفنشر)\n3) نوع الدراجة (سبورت / كروزر / سكوتر / أدفنشر)\n4) لو عندك ماركة مفضلة اذكرها (مثال: Shoei, HJC, AGV)\n5) ميزانيتك التقريبية (مثال: لغاية 500 ريال، 500–1000، أكثر من 1000)\n\nانسخ الكلام فوق وعدّل عليه وارسل التفاصيل في رسالة واحدة."
      : "To help you professionally, please send *one message* with:\n1) Item type (full-face helmet / jacket / gloves / boots)\n2) Usage (city / touring / adventure)\n3) Bike type (sport / cruiser / scooter / adventure)\n4) Preferred brand if any (e.g. Shoei, HJC, AGV)\n5) Approximate budget.\n\nCopy the template, edit it, and send in one message.",
    proAccessoryAsk: isAr
      ? "واضح إنك تدور على إكسسوارات.\nعشان أضبط لك رابط بحث محترف، اكتب في *رسالة واحدة*:\n1) نوع الإكسسوار (حامل جوال، شنطة خلفية، شنطة خزان، شاحن USB...)\n2) وين رح يتركّب (مقود، خزان، خلف الدراجة...)\n3) نوع الاستخدام (مدينة / سفر / أدفنشر)\n4) نوع الدراجة (سبورت / كروزر / سكوتر / أدفنشر)\n5) ماركة مفضلة + ميزانية إن وجدت."
      : "It looks like you need accessories.\nTo build a pro search link, send in *one message*:\n1) Accessory type\n2) Mounting position\n3) Usage (city/touring/adventure)\n4) Bike type\n5) Preferred brand + budget if any.",
    proSpareAsk: isAr
      ? "عشان أقدر أجيب لك رابط لقطعة غيار مضبوط قدر الإمكان، اكتب لي في *رسالة واحدة*:\n1) نوع الدراجة (سبورت / كروزر / سكوتر / أدفنشر)\n2) ماركة الدراجة (Yamaha, Honda, BMW, KTM ...)\n3) موديل الدراجة (R3, CBR500 ...)\n4) سنة الموديل\n5) اسم القطعة أو وصفها (مثال: تيل فرامل أمامي، فلتر زيت، جنزير، سلايدر...)."
      : "To get you the best possible spare-part search link, send in *one message*:\n1) Bike type\n2) Brand\n3) Model\n4) Model year\n5) Part name or description.",
    notEnoughInfoSafety: isAr
      ? "فهمت إنك تسأل عن معدات سلامة، لكن المعلومات لسه ناقصة عشان أضبط لك رابط واحد مضبوط.\n\n"
      : "I understand you’re asking about safety gear, but I still don’t have enough info to build a precise link.\n\n",
    notEnoughInfoAccessory: isAr
      ? "فهمت إنك تحتاج إكسسوارات، لكن لسه التفاصيل ناقصة شوي عشان أضبط لك رابط واحد مضبوط.\n\n"
      : "I see you need accessories, but I need a bit more detail to build a precise link.\n\n",
    notEnoughInfoSpare: isAr
      ? "فهمت إنك تحتاج قطعة غيار، لكن لسه البيانات ناقصة عشان أضبط لك رابط مضبوط لموديل دراجتك.\n\n"
      : "I see you need a spare part, but I’m still missing info to build a precise link for your bike.\n\n",
    fallback: isAr
      ? "فهمت طلبك بشكل عام، لكن عشان أقدر أساعدك صح، وضّح لي: هل تبحث عن معدات سلامة، قطع غيار، أم إكسسوارات للدراجة؟"
      : "I get your request in general, but to help properly, tell me whether you’re asking about safety gear, spare parts, or accessories.",
  };
}

/* ===== Helpers لتحويل القيم المختصرة إلى نص ===== */

function usageLabel(usage, lang = "ar") {
  const isAr = lang === "ar";
  if (!usage) return null;
  if (usage === "city") return isAr ? "استخدام مدينة/مشاوير يومية" : "city use";
  if (usage === "touring")
    return isAr ? "سفر/هاي وي" : "touring/highway use";
  if (usage === "adventure")
    return isAr ? "أدفنشر/اوف رود" : "adventure/off-road use";
  return usage;
}

function bikeTypeLabel(bikeType, lang = "ar") {
  const isAr = lang === "ar";
  if (!bikeType) return null;
  if (bikeType === "sport") return isAr ? "دراجة سبورت" : "sport bike";
  if (bikeType === "cruiser") return isAr ? "دراجة كروزر" : "cruiser";
  if (bikeType === "scooter") return isAr ? "سكوتر" : "scooter";
  if (bikeType === "adventure")
    return isAr ? "دراجة أدفنشر/اوف رود" : "adventure/off-road bike";
  return bikeType;
}

function helmetLabel(type, lang = "ar") {
  const isAr = lang === "ar";
  if (!type) return null;
  if (type === "helmet-fullface")
    return isAr ? "خوذة فل فيس" : "full face helmet";
  if (type === "helmet-openface")
    return isAr ? "خوذة نص وجه" : "open face helmet";
  if (type === "helmet-modular")
    return isAr ? "خوذة موديولار" : "modular helmet";
  return isAr ? "خوذة" : "helmet";
}

/* ===== كشف البراند (للمعدات) ===== */

const GEAR_BRANDS = [
  "shoei",
  "arai",
  "agv",
  "hjc",
  "ls2",
  "alpinestars",
  "dainese",
  "revit",
  "rev'it",
  "icon",
  "scorpion",
  "bell",
];

const BIKE_BRANDS = [
  "yamaha",
  "honda",
  "kawasaki",
  "suzuki",
  "bmw",
  "ktm",
  "ducati",
  "harley",
  "harley-davidson",
  "triumph",
  "royal enfield",
  "royal-enfield",
  "cf moto",
  "cfmoto",
  "benelli",
];

function detectGearBrand(message = "") {
  const msg = message.toLowerCase();
  for (const b of GEAR_BRANDS) {
    if (msg.includes(b)) {
      return b.toUpperCase();
    }
  }
  return null;
}

function detectBikeBrandAndModel(message = "") {
  const original = message;
  const msg = message.toLowerCase();
  for (const rawBrand of BIKE_BRANDS) {
    const idx = msg.indexOf(rawBrand);
    if (idx !== -1) {
      const brandPretty = rawBrand
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const after = original.slice(idx + rawBrand.length).trim();
      const modelToken = after.split(/\s+/)[0].replace(/[^\w\-]/g, "");
      const model = modelToken || null;
      return { brand: brandPretty, model };
    }
  }
  return { brand: null, model: null };
}

/* ===== كشف الكاتيجوري من الرسالة فقط (بدون إجبار من الذاكرة) ===== */

function detectCategory(message = "", context = {}) {
  const msg = (message || "").toLowerCase();

  const safetyWords = [
    "خوذة",
    "خودة",
    "helmet",
    "جاكيت",
    "jacket",
    "جاكيت حماية",
    "jacket protection",
    "قفازات",
    "قلفز",
    "gloves",
    "بوت",
    "جزمة",
    "boots",
    "حذاء",
    "درع",
    "protector",
    "حماية",
  ];

  const spareWords = [
    "قطعة",
    "قطع",
    "غيار",
    "spare",
    "فلتر",
    "filter",
    "بلكات",
    "بواجي",
    "spark",
    "plug",
    "تيل",
    "pads",
    "بريك",
    "فرامل",
    "chain",
    "جنزير",
    "sprocket",
  ];

  const accessoryWords = [
    "اكسسوار",
    "اكسسوارات",
    "accessory",
    "حامل",
    "ستاند",
    "stand",
    "rack",
    "bag",
    "شنطة",
    "حقيبة",
    "phone mount",
    "mobile holder",
    "charger",
    "شاحن",
  ];

  const has = (list) => list.some((w) => msg.includes(w));

  if (has(safetyWords)) return "safety";
  if (has(spareWords)) return "spare-part";
  if (has(accessoryWords)) return "accessory";

  // لو ما قدر يحدد من الرسالة، ممكن يستخدم الكاتيجوري القادم من الواجهة (لو تم تمريره صراحة)
  if (context && context.category) return context.category;

  return null;
}

/* ===== كشف نوع الخوذة / نوع الدراجة / نوع الاستخدام ===== */

function detectHelmetType(message = "", context = {}) {
  const msg = message.toLowerCase();

  if (msg.includes("فل") || msg.includes("full")) return "helmet-fullface";
  if (msg.includes("نص") || msg.includes("open")) return "helmet-openface";
  if (msg.includes("موديولار") || msg.includes("modular"))
    return "helmet-modular";

  return null;
}

function detectBikeType(message = "", context = {}) {
  const msg = message.toLowerCase();

  if (msg.includes("سبورت") || msg.includes("sport")) return "sport";
  if (msg.includes("كروزر") || msg.includes("cruiser")) return "cruiser";
  if (msg.includes("سكوتر") || msg.includes("scooter")) return "scooter";
  if (
    msg.includes("ادفنتشر") ||
    msg.includes("أدفنشر") ||
    msg.includes("adventure") ||
    msg.includes("اوف رود") ||
    msg.includes("offroad") ||
    msg.includes("off-road")
  )
    return "adventure";

  return null;
}

function detectUsage(message = "", context = {}) {
  const msg = message.toLowerCase();

  if (msg.includes("مدينة") || msg.includes("daily") || msg.includes("commute"))
    return "city";

  if (
    msg.includes("سفر") ||
    msg.includes("long") ||
    msg.includes("هاي وي") ||
    msg.includes("highway") ||
    msg.includes("touring")
  )
    return "touring";

  if (
    msg.includes("ادفنتشر") ||
    msg.includes("أدفنشر") ||
    msg.includes("offroad") ||
    msg.includes("off-road") ||
    msg.includes("رمال")
  )
    return "adventure";

  return null;
}

/* =========================
   منطق معدات السلامة (خوذة / جاكيت / قفازات / بوت)
   ========================= */

function handleSafetyFlow(message, lang, context = {}) {
  const t = T(lang);
  const msg = message.toLowerCase();

  const mentionsHelmet =
    msg.includes("خوذة") || msg.includes("خودة") || msg.includes("helmet");
  const mentionsJacket =
    msg.includes("جاكيت") ||
    msg.includes("jacket") ||
    msg.includes("جاكيت حماية");
  const mentionsGloves =
    msg.includes("قفازات") ||
    msg.includes("قلفز") ||
    msg.includes("gloves");
  const mentionsBoots =
    msg.includes("بوت") ||
    msg.includes("جزمة") ||
    msg.includes("boots") ||
    msg.includes("حذاء");

  let itemType = null;
  if (mentionsHelmet) {
    const ht = detectHelmetType(message);
    itemType = ht || "helmet-unknown";
  } else if (mentionsJacket) {
    itemType = "jacket";
  } else if (mentionsGloves) {
    itemType = "gloves";
  } else if (mentionsBoots) {
    itemType = "boots";
  }

  const usage = detectUsage(message) || null;
  const bikeType = detectBikeType(message) || null;
  const gearBrand = detectGearBrand(message);

  const missingInfo = [];
  if (!itemType) missingInfo.push("itemType");
  if (!usage) missingInfo.push("usage");
  if (!bikeType) missingInfo.push("bikeType");

  // لو المعلومات غير كافية → أسلوب المستشار (طلب تفاصيل في رسالة واحدة)
  if (missingInfo.length > 0) {
    const intro =
      lang === "ar"
        ? `${t.welcomeLine}\n\n${t.notEnoughInfoSafety}`
        : `${t.welcomeLine}\n\n${t.notEnoughInfoSafety}`;
    return {
      category: "safety",
      itemType,
      bikeType,
      bikeBrand: gearBrand || null,
      bikeModel: null,
      bikeYear: null,
      usage,
      partName: null,
      missingInfo,
      amazonSearch: null,
      reply: intro + t.proSafetyAsk,
    };
  }

  // لو المعلومات الأساسية كافية → نبني رابط Amazon مخصص
  const amazonSearch = buildAmazonSearchLinkFromContext({
    category: "safety",
    itemType,
    usage,
    bikeType,
    brand: gearBrand,
    model: null,
    partName: null,
    lang,
  });

  const usageText = usageLabel(usage, lang);
  const bikeTypeText = bikeTypeLabel(bikeType, lang);

  let itemText = null;
  if (itemType && itemType.startsWith("helmet")) {
    itemText = helmetLabel(itemType, lang);
  } else if (itemType === "jacket") {
    itemText = lang === "ar" ? "جاكيت حماية" : "riding jacket";
  } else if (itemType === "gloves") {
    itemText = lang === "ar" ? "قفازات حماية" : "riding gloves";
  } else if (itemType === "boots") {
    itemText = lang === "ar" ? "حذاء/بوت ركوب" : "riding boots";
  }

  let summaryLine;
  if (lang === "ar") {
    summaryLine =
      "تمام، فهمت احتياجك 👌\nأنت تبحث عن " +
      (itemText || "معدات سلامة") +
      (usageText ? ` للاستخدام: ${usageText}` : "") +
      (bikeTypeText ? ` على ${bikeTypeText}` : "") +
      (gearBrand ? ` مع تفضيل ماركة: ${gearBrand}` : "") +
      ".";
  } else {
    summaryLine =
      "Great, I understand your need 👌\nYou are looking for " +
      (itemText || "safety gear") +
      (usageText ? ` for ${usageText}` : "") +
      (bikeTypeText ? ` on ${bikeTypeText}` : "") +
      (gearBrand ? ` with brand preference: ${gearBrand}` : "") +
      ".";
  }

  const amazonLine =
    amazonSearch && amazonSearch.url
      ? lang === "ar"
        ? `\n\n🔍 هذا رابط بحث مخصص على Amazon حسب طلبك:\n${amazonSearch.url}\n\nنصيحتي: استخدم الفلاتر داخل Amazon لضبط المقاس، اللون، والسعر المناسب لك.`
        : `\n\n🔍 Here is a tailored Amazon search link based on your request:\n${amazonSearch.url}\n\nTip: use Amazon filters to tune size, color, and budget.`
      : "";

  return {
    category: "safety",
    itemType,
    bikeType,
    bikeBrand: gearBrand || null,
    bikeModel: null,
    bikeYear: null,
    usage,
    partName: null,
    missingInfo,
    amazonSearch: amazonSearch || null,
    reply: `${t.welcomeLine}\n\n${summaryLine}${amazonLine}`,
  };
}

/* =========================
   منطق قطع الغيار
   ========================= */

function handleSparePartFlow(message, lang, context = {}) {
  const t = T(lang);
  const msg = message.toLowerCase();

  const bikeType = detectBikeType(message) || null;
  let { brand: bikeBrand, model: bikeModel } = detectBikeBrandAndModel(message);

  // سنة الموديل
  let bikeYear = null;
  const yearMatch = msg.match(/20[0-3][0-9]/);
  if (yearMatch) {
    bikeYear = yearMatch[0];
  }

  // اسم القطعة البسيط
  let partName = null;
  if (msg.includes("فلتر")) partName = "فلتر زيت";
  else if (msg.includes("تيل") || msg.includes("pads")) partName = "تيل فرامل";
  else if (msg.includes("جنزير") || msg.includes("chain")) partName = "جنزير";
  else if (msg.includes("بلكات") || msg.includes("بواجي")) partName = "بواجي / شمعة احتراق";

  const missingInfo = [];
  if (!bikeType) missingInfo.push("bikeType");
  if (!bikeBrand) missingInfo.push("bikeBrand");
  if (!bikeModel) missingInfo.push("bikeModel");
  if (!bikeYear) missingInfo.push("bikeYear");
  if (!partName) missingInfo.push("partName");

  // لو المعلومات غير كافية → نطلب من العميل يرسلها في رسالة واحدة
  if (missingInfo.length > 0) {
    const intro =
      lang === "ar"
        ? `${t.welcomeLine}\n\n${t.notEnoughInfoSpare}`
        : `${t.welcomeLine}\n\n${t.notEnoughInfoSpare}`;

    return {
      category: "spare-part",
      itemType: "spare-part",
      bikeType,
      bikeBrand: bikeBrand,
      bikeModel: bikeModel,
      bikeYear,
      usage: null,
      partName,
      missingInfo,
      amazonSearch: null,
      reply: intro + t.proSpareAsk,
    };
  }

  // معلومات كافية → نبني رابط أمازون محدد
  const amazonSearch = buildAmazonSearchLinkFromContext({
    category: "spare-part",
    itemType: "spare-part",
    usage: null,
    bikeType,
    brand: bikeBrand,
    model: bikeModel,
    year: bikeYear,
    partName,
    lang,
  });

  const bikeDesc =
    lang === "ar"
      ? `${bikeBrand} ${bikeModel} موديل ${bikeYear}`
      : `${bikeBrand} ${bikeModel} (${bikeYear})`;

  const header =
    lang === "ar"
      ? `ممتاز، صار عندي بيانات كافية عن دراجتك:\n- ${bikeDesc}\n- القطعة المطلوبة: ${partName}`
      : `Great, I now have enough info about your bike:\n- ${bikeDesc}\n- Requested part: ${partName}`;

  const amazonLine =
    amazonSearch && amazonSearch.url
      ? lang === "ar"
        ? `\n\n🔍 هذا رابط بحث مخصص على Amazon لقطع الغيار حسب طلبك:\n${amazonSearch.url}\n\n*ملاحظة:* قبل الشراء تأكد من رقم القطعة (Part Number) وتوافقها مع موديل وسنة دراجتك.`
        : `\n\n🔍 Here is a tailored Amazon search link for your spare part:\n${amazonSearch.url}\n\n*Note:* Before purchasing, double-check the part number and compatibility with your bike's model and year.`
      : "";

  return {
    category: "spare-part",
    itemType: "spare-part",
    bikeType,
    bikeBrand,
    bikeModel,
    bikeYear,
    usage: null,
    partName,
    missingInfo,
    amazonSearch: amazonSearch || null,
    reply: `${t.welcomeLine}\n\n${header}${amazonLine}`,
  };
}

/* =========================
   منطق الإكسسوارات
   ========================= */

function handleAccessoryFlow(message, lang, context = {}) {
  const t = T(lang);
  const msg = message.toLowerCase();

  const usage = detectUsage(message) || null;
  const bikeType = detectBikeType(message) || null;

  // محاولة بسيطة لمعرفة نوع الإكسسوار
  let accessoryName = null;
  if (msg.includes("جوال") || msg.includes("phone") || msg.includes("holder")) {
    accessoryName = "حامل جوال";
  } else if (msg.includes("شنطة خلفية") || msg.includes("top case")) {
    accessoryName = "شنطة خلفية";
  } else if (msg.includes("شنطة خزان") || msg.includes("tank bag")) {
    accessoryName = "شنطة خزان";
  } else if (msg.includes("شاحن") || msg.includes("charger") || msg.includes("usb")) {
    accessoryName = "شاحن USB";
  }

  const gearBrand = detectGearBrand(message);

  const missingInfo = [];
  if (!accessoryName) missingInfo.push("accessoryType");
  if (!usage) missingInfo.push("usage");
  if (!bikeType) missingInfo.push("bikeType");

  if (missingInfo.length > 0) {
    const intro =
      lang === "ar"
        ? `${t.welcomeLine}\n\n${t.notEnoughInfoAccessory}`
        : `${t.welcomeLine}\n\n${t.notEnoughInfoAccessory}`;

    return {
      category: "accessory",
      itemType: "accessory",
      bikeType,
      bikeBrand: gearBrand || null,
      bikeModel: null,
      bikeYear: null,
      usage,
      partName: accessoryName,
      missingInfo,
      amazonSearch: null,
      reply: intro + t.proAccessoryAsk,
    };
  }

  // معلومات كافية → نبني رابط أمازون
  const amazonSearch = buildAmazonSearchLinkFromContext({
    category: "accessory",
    itemType: "accessory",
    usage,
    bikeType,
    brand: gearBrand,
    model: null,
    partName: accessoryName,
    lang,
  });

  const usageText = usageLabel(usage, lang);
  const bikeTypeText = bikeTypeLabel(bikeType, lang);

  let header;
  if (lang === "ar") {
    header =
      "ممتاز، صار عندي صورة واضحة عن نوع الإكسسوارات اللي تناسب استخدامك ودراجتك.\n" +
      `- نوع الإكسسوار: ${accessoryName}\n` +
      `- نوع الاستخدام: ${usageText || "غير محدد"}\n` +
      `- نوع الدراجة: ${bikeTypeText || "غير محدد"}` +
      (gearBrand ? `\n- تفضيل ماركة: ${gearBrand}` : "");
  } else {
    header =
      "Great, I now have a clear idea about the accessories that fit your ride.\n" +
      `- Accessory type: ${accessoryName}\n` +
      `- Usage: ${usageText || "not specified"}\n` +
      `- Bike type: ${bikeTypeText || "not specified"}` +
      (gearBrand ? `\n- Brand preference: ${gearBrand}` : "");
  }

  const amazonLine =
    amazonSearch && amazonSearch.url
      ? lang === "ar"
        ? `\n\n🔍 هذا رابط بحث مخصص على Amazon للإكسسوارات المناسبة:\n${amazonSearch.url}`
        : `\n\n🔍 Here is a tailored Amazon search link for suitable accessories:\n${amazonSearch.url}`
      : "";

  return {
    category: "accessory",
    itemType: "accessory",
    bikeType,
    bikeBrand: gearBrand || null,
    bikeModel: null,
    bikeYear: null,
    usage,
    partName: accessoryName,
    missingInfo,
    amazonSearch: amazonSearch || null,
    reply: `${t.welcomeLine}\n\n${header}${amazonLine}`,
  };
}

/* =========================
   Health Check
   ========================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Rider Purchases Bot",
    message: "رايدر المشتريات يعمل بنجاح ✅",
  });
});

/* =========================
   Endpoint الدردشة الرئيسي
   ========================= */

app.post("/api/chat/purchases", async (req, res) => {
  try {
    const { message, lang = "ar", userId, context = {} } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "الرسالة مطلوبة (message) ويجب أن تكون نص.",
      });
    }

    const t = T(lang);
    const profileUserId = userId || "guest";

    // 1) جلب ملف المشتريات (للتاريخ فقط، مش لاستخدامه بقوة في المنطق)
    let existingProfile = null;
    if (MONGODB_URI && mongoose.connection.readyState === 1) {
      existingProfile = await PurchaseProfile.findOne({ userId: profileUserId });
    }

    // 2) لا ندمج الذاكرة في المنطق (كل رسالة تُفهم لوحدها)
    const mergedContext = {
      ...(context || {}),
    };

    // 3) تحليل الرسالة
    const category = detectCategory(message, mergedContext);

    let result;
    if (category === "safety") {
      result = handleSafetyFlow(message, lang, mergedContext);
    } else if (category === "spare-part") {
      result = handleSparePartFlow(message, lang, mergedContext);
    } else if (category === "accessory") {
      result = handleAccessoryFlow(message, lang, mergedContext);
    } else {
      result = {
        category: null,
        itemType: null,
        bikeType: null,
        bikeBrand: null,
        bikeModel: null,
        bikeYear: null,
        usage: null,
        partName: null,
        missingInfo: ["category"],
        amazonSearch: null,
        reply: `${t.welcomeLine}\n\n${t.genericIntro}\n\n${t.fallback}`,
      };
    }

    // 4) تحديث ملف المشتريات في MongoDB (كتاريخ فقط)
    if (MONGODB_URI && mongoose.connection.readyState === 1) {
      const profileUpdate = {
        lastCategory: result.category || existingProfile?.lastCategory || null,
        lastItemType: result.itemType || existingProfile?.lastItemType || null,
        lastBikeBrand: result.bikeBrand || existingProfile?.lastBikeBrand || null,
        lastBikeModel: result.bikeModel || existingProfile?.lastBikeModel || null,
        lastBikeYear: result.bikeYear || existingProfile?.lastBikeYear || null,
        lastPartName: result.partName || existingProfile?.lastPartName || null,
        preferredBikeType:
          result.bikeType || existingProfile?.preferredBikeType || null,
        lastUsage: result.usage || existingProfile?.lastUsage || null,
      };

      await PurchaseProfile.findOneAndUpdate(
        { userId: profileUserId },
        {
          $set: profileUpdate,
          $push: {
            history: {
              message,
              reply: result.reply,
              category: result.category || null,
              itemType: result.itemType || null,
            },
          },
        },
        { upsert: true, new: true }
      );
    }

    // 5) إرسال الرد
    return res.json({
      ok: true,
      botName: t.botName,
      category: result.category,
      itemType: result.itemType || null,
      bikeType: result.bikeType || null,
      bikeBrand: result.bikeBrand || null,
      bikeModel: result.bikeModel || null,
      bikeYear: result.bikeYear || null,
      usage: result.usage || null,
      partName: result.partName || null,
      missingInfo: result.missingInfo || [],
      reply: result.reply,
      amazonSearch: result.amazonSearch
        ? {
            query: result.amazonSearch.query || null,
            url: result.amazonSearch.url,
          }
        : null,
      debug: {
        receivedMessage: message,
        receivedLang: lang,
        receivedUserId: profileUserId,
        receivedContext: context || null,
        detectedCategory: category,
      },
    });
  } catch (err) {
    console.error("Purchases bot error:", err);
    return res.status(500).json({
      ok: false,
      error: "حدث خطأ غير متوقع في بوت رايدر المشتريات.",
    });
  }
});

/* =========================
   تشغيل السيرفر
   ========================= */

app.listen(PORT, () => {
  console.log(`🚀 Rider Purchases Bot running on port ${PORT}`);
});

// server.js
// Backend مستقل - بوت رايدر المشتريات
// MongoDB + ملف مشتريات لكل عميل + ذاكرة قوية + اختيار أفضل المنتجات + رابط بحث Amazon

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

// منطق اختيار المنتجات من القائمة الداخلية (خوذة + جاكيت + قفازات + حذاء + إكسسوارات)
const { searchProducts } = require("./logic/productSearch");
// خدمة بناء رابط بحث Amazon حسب السياق (تستخدم الـ Affiliate Tag)
const {
  buildAmazonSearchLinkFromContext,
} = require("./services/amazonSearch");

const app = express();

// إعدادات أساسية
const PORT = process.env.PORT || 5050;
console.log("ℹ️ Rider Purchases Bot starting on PORT =", PORT);

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

    // آخر تفضيلات معروفة
    preferredBikeType: { type: String, default: null }, // sport / cruiser / scooter / adventure
    lastUsage: { type: String, default: null }, // city / touring / adventure

    lastCategory: { type: String, default: null }, // safety / spare-part / accessory
    lastItemType: { type: String, default: null }, // helmet-fullface / jacket / gloves / boots / spare-part

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
      ? "مهمتي أساعدك تختار منتج مناسب وأرشدك لأفضل وأرخص موقع متاح حسب طلبك."
      : "My goal is to help you choose the right product and point you to the best and most affordable site.",
    askHelmetType: isAr
      ? "فهمت إنك مهتم بخوذة.\nقبل ما أبحث لك عن خيارات مناسبة، حاب أعرف نوع الخوذة اللي تفضلها أكثر:\n- فل فيس (Full Face)\n- نص وجه (Open Face)\n- موديولار (Modular)\nاكتب نوع الخوذة اللي تفضله."
      : "Got it, you're looking for a helmet.\nBefore I search for good options, I'd like to know which helmet type you prefer:\n- Full face\n- Open face\n- Modular\nType your preferred helmet type.",
    askUsage: isAr
      ? "كمان يهمني أعرف استخدامك أكثر شيء:\n- مدينة (مشاوير يومية)\n- سفر/هاي وي\n- أدفنشر/اوف رود\nاكتب نوع الاستخدام الأقرب لك."
      : "I also need to know your main use:\n- City (daily commuting)\n- Highway / touring\n- Adventure / off-road\nType the option that matches you.",
    askBikeTypeForSafety: isAr
      ? "آخر نقطة: دراجتك أقرب لأي فئة؟\n- سبورت\n- كروزر\n- سكوتر\n- أدفنشر/اوف رود\nاكتب الفئة اللي تناسب دراجتك."
      : "Last point: Which type is your bike closer to?\n- Sport\n- Cruiser\n- Scooter\n- Adventure / off-road\nType the matching category.",
    safetyAlmostReady: isAr
      ? "ممتاز 👍 تقريباً صار عندي صورة واضحة، بعد ما توضح لي النقاط اللي فوق أقدر أوجد لك خيارات مناسبة وأرخص مواقع متاحة."
      : "Great 👍 Once you answer the questions above, I can suggest suitable options and the best sites.",
    askSparePartCore: isAr
      ? "فهمت إنك بدك قطعة غيار.\nعشان أساعدك بدقة، لازم أعرف بالضبط:\n1) نوع الدراجة (مثال: سبورت، كروزر، سكوتر، أدفنشر)\n2) الماركة والموديل (مثال: Yamaha R3 أو Honda CBR500)\n3) سنة الموديل\n4) اسم القطعة أو وصفها (مثال: تيل فرامل أمامي، فلتر زيت، جنزير...)."
      : "Got it, you're looking for a spare part.\nTo help accurately I need:\n1) Bike type (sport, cruiser, scooter, adventure)\n2) Brand & model (e.g. Yamaha R3 or Honda CBR500)\n3) Year model\n4) Name/description of the part (e.g. front brake pads, oil filter, chain...).",
    sparePartNextStep: isAr
      ? "اكتب المعلومات اللي تعرفها من النقاط اللي فوق، حتى لو ما كانت كاملة، وأنا أرتب لك الخيارات وأبحث عن أفضل موقع مناسب."
      : "Write the info you know from the points above, even if not complete, and I’ll search for the best options and sites.",
    askAccessory: isAr
      ? "واضح أنك تدور على إكسسوار للدراجة.\nحاب أعرف نوع الإكسسوار ووين رح يُركّب بالضبط (مثلاً: حامل جوال على المقود، شنطة خلفية، شنطة خزان...)."
      : "It looks like you're looking for an accessory.\nI need to know what type of accessory and where it will be mounted (e.g. phone mount on handlebar, rear bag, tank bag...).",
    accessoryUsage: isAr
      ? "برضه يساعدني أعرف هل الاستخدام أكثر للمدينة، سفر طويل، أو أدفنشر، عشان أوازن بين الراحة والمتانة والسعر."
      : "It also helps to know if you ride mostly in the city, long-distance touring, or adventure, so I can balance comfort, durability, and price.",
    fallback: isAr
      ? "فهمت طلبك بشكل عام، لكن عشان أقدر أساعدك صح، اشرح لي أكثر: هل اللي تحتاجه يندرج تحت معدات السلامة، قطع غيار، أو إكسسوارات للدراجة؟"
      : "I understand your request in general, but to help you properly, please clarify: Is this about safety gear, spare parts, or accessories?",
  };
}

// ===== Helpers لتحويل القيم المختصرة إلى نص =====

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

// كشف الكاتيجوري من الرسالة أو الـ context
function detectCategory(message = "", context = {}) {
  if (context.category) return context.category;

  const msg = message.toLowerCase();

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

  return null;
}

// كشف نوع الخوذة من الكلام أو من الـ context
function detectHelmetType(message = "", context = {}) {
  if (context.itemType && context.itemType.startsWith("helmet")) {
    return context.itemType;
  }

  const msg = message.toLowerCase();

  if (msg.includes("فل") || msg.includes("full")) return "helmet-fullface";
  if (msg.includes("نص") || msg.includes("open")) return "helmet-openface";
  if (msg.includes("موديولار") || msg.includes("modular"))
    return "helmet-modular";

  if (msg.includes("helmet")) return null;
  if (msg.includes("خوذة") || msg.includes("خودة")) return null;

  return null;
}

// كشف نوع الدراجة من الرسالة أو الـ context
function detectBikeType(message = "", context = {}) {
  if (context.bikeType) return context.bikeType;
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

// كشف الاستخدام (مدينة / سفر / أدفنشر)
function detectUsage(message = "", context = {}) {
  if (context.usage) return context.usage;
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

// منطق الرد في حالة معدات السلامة (خوذة + جاكيت + قفازات + بوت)
function handleSafetyFlow(message, lang, context) {
  const t = T(lang);

  const msg = message.toLowerCase();

  const helmetTypeDetected = detectHelmetType(message, context);
  const mentionsHelmet =
    msg.includes("خوذة") ||
    msg.includes("خودة") ||
    msg.includes("helmet") ||
    (context.itemType && context.itemType.startsWith("helmet"));

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

  // تحديد نوع القطعة: خوذة أو جاكيت أو قفازات أو بوت
  let itemType = context.itemType || null;
  if (helmetTypeDetected) {
    itemType = helmetTypeDetected;
  } else if (!itemType && mentionsJacket) {
    itemType = "jacket";
  } else if (!itemType && mentionsGloves) {
    itemType = "gloves";
  } else if (!itemType && mentionsBoots) {
    itemType = "boots";
  }

  const bikeType = detectBikeType(message, context) || context.bikeType;
  const usage = detectUsage(message, context) || context.usage;

  const missing = [];

  // نحتاج usage + bikeType لكل معدات السلامة
  if (!usage) missing.push("usage");
  if (!bikeType) missing.push("bikeType");

  // لو خوذة والـ type غير محدد بوضوح
  if (
    (!helmetTypeDetected && mentionsHelmet) ||
    (itemType && itemType === "helmet-unknown")
  ) {
    if (!missing.includes("helmetType")) missing.push("helmetType");
  }

  let replyParts = [t.welcomeLine];

  // جملة شخصية مبنية على الذاكرة
  const helmetText =
    itemType && itemType.startsWith("helmet")
      ? helmetLabel(itemType, lang)
      : null;
  const usageText = usageLabel(usage, lang);
  const bikeTypeText = bikeTypeLabel(bikeType, lang);

  if (helmetText || usageText || bikeTypeText) {
    let summary = "";
    if (helmetText) summary += helmetText;
    if (usageText) {
      summary += summary ? " للاستخدام " + usageText : usageText;
    }
    if (bikeTypeText) {
      summary += summary ? " وعلى " + bikeTypeText : bikeTypeText;
    }

    if (summary) {
      replyParts.push(
        lang === "ar"
          ? `مسجّل عندي إنك مهتم بـ ${summary}.`
          : `I have noted that you're interested in ${summary}.`
      );
    }
  } else {
    replyParts.push(t.genericIntro);
  }

  if (mentionsHelmet) {
    // خوذة: نسأل عن النوع + الاستخدام + نوع الدراجة
    if (!helmetTypeDetected && !context.itemType) replyParts.push(t.askHelmetType);
    if (!usage) replyParts.push(t.askUsage);
    if (!bikeType) replyParts.push(t.askBikeTypeForSafety);

    if (missing.length === 0) {
      replyParts.push(
        t.safetyAlmostReady +
          (lang === "ar"
            ? "\nبعدها أقدر أجهز لك ترشيحات خوذات وروابط لأفضل الأسعار."
            : "\nThen I can prepare helmet recommendations and best-price links.")
      );
    }
  } else if (mentionsJacket) {
    // جاكيت حماية
    if (!usage) replyParts.push(t.askUsage);
    if (!bikeType) replyParts.push(t.askBikeTypeForSafety);

    if (missing.length === 0) {
      replyParts.push(
        t.safetyAlmostReady +
          (lang === "ar"
            ? "\nبعدها أقدر أجهز لك ترشيحات جاكيتات حماية وروابط لأفضل الأسعار."
            : "\nThen I can prepare jacket recommendations and best-price links.")
      );
    }
  } else if (mentionsGloves) {
    // قفازات حماية
    if (!usage) replyParts.push(t.askUsage);
    if (!bikeType) replyParts.push(t.askBikeTypeForSafety);

    if (missing.length === 0) {
      replyParts.push(
        t.safetyAlmostReady +
          (lang === "ar"
            ? "\nبعدها أقدر أجهز لك ترشيحات قفازات حماية وروابط لأفضل الأسعار."
            : "\nThen I can prepare glove recommendations and best-price links.")
      );
    }
  } else if (mentionsBoots) {
    // حذاء/بوت حماية
    if (!usage) replyParts.push(t.askUsage);
    if (!bikeType) replyParts.push(t.askBikeTypeForSafety);

    if (missing.length === 0) {
      replyParts.push(
        t.safetyAlmostReady +
          (lang === "ar"
            ? "\nبعدها أقدر أجهز لك ترشيحات أحذية ركوب موتوسايكل وروابط لأفضل الأسعار."
            : "\nThen I can prepare riding boots recommendations and best-price links.")
      );
    }
  } else {
    // معدات سلامة عامة
    replyParts.push(
      lang === "ar"
        ? "واضح أنك تبحث عن معدات سلامة للدراجة (مثل خوذة، جاكيت، قفازات أو بوت).\nحدد لي أكثر: شو نوع القطعة اللي في بالك؟"
        : "It seems you're looking for safety gear (helmet, jacket, gloves, boots, etc.).\nTell me which item you have in mind."
    );
  }

  return {
    category: "safety",
    itemType:
      itemType ||
      (mentionsHelmet
        ? "helmet-unknown"
        : mentionsJacket
        ? "jacket"
        : mentionsGloves
        ? "gloves"
        : mentionsBoots
        ? "boots"
        : null),
    bikeType: bikeType || null,
    usage: usage || null,
    missingInfo: missing,
    reply: replyParts.join("\n\n"),
  };
}

// منطق الرد في حالة قطع الغيار
function handleSparePartFlow(message, lang, context) {
  const t = T(lang);

  const bikeType = detectBikeType(message, context) || context.bikeType;
  let brand = context.bikeBrand || null;
  let model = context.bikeModel || null;
  let year = context.bikeYear || null;

  const msg = message.toLowerCase();

  // محاولة بسيطة لاستخراج سنة موديل لو العميل كتب 2018 أو 2020 مثلاً
  const yearMatch = msg.match(/20[0-3][0-9]/);
  if (!year && yearMatch) {
    year = yearMatch[0];
  }

  // استخراج اسم القطعة بشكل بسيط
  let partName = context.partName || null;
  if (!partName) {
    if (msg.includes("فلتر")) partName = "فلتر زيت";
    else if (msg.includes("تيل") || msg.includes("pads")) partName = "تيل فرامل";
    else if (msg.includes("جنزير") || msg.includes("chain")) partName = "جنزير";
  }

  const missing = [];
  if (!bikeType) missing.push("bikeType");
  if (!brand) missing.push("bikeBrand");
  if (!model) missing.push("bikeModel");
  if (!year) missing.push("bikeYear");
  if (!partName) missing.push("partName");

  let replyParts = [t.welcomeLine, t.genericIntro, t.askSparePartCore];

  // لو في بعض المعلومات موجودة، نلخصها للعميل
  const pieces = [];
  if (bikeType) pieces.push(bikeTypeLabel(bikeType, lang));
  if (brand || model) {
    const bm = [brand, model].filter(Boolean).join(" ");
    if (bm) pieces.push(bm);
  }
  if (year) pieces.push(lang === "ar" ? `موديل ${year}` : `model year ${year}`);
  if (partName) {
    pieces.push(
      lang === "ar" ? `القطعة المطلوبة: ${partName}` : `requested part: ${partName}`
    );
  }

  if (pieces.length) {
    replyParts.push(
      lang === "ar"
        ? `المعلومات اللي فهمتها حتى الآن:\n- ${pieces.join("\n- ")}`
        : `Here is what I understood so far:\n- ${pieces.join("\n- ")}`
    );
  }

  // توضيح ما ينقص
  if (missing.length) {
    if (lang === "ar") {
      replyParts.push(
        "عشان أقدر أحدد روابط دقيقة لقطع الغيار، حاول قدر الإمكان تزودني بالتالي (إن أمكن):\n" +
          (missing.includes("bikeType")
            ? "- نوع الدراجة (سبورت / كروزر / سكوتر / أدفنشر)\n"
            : "") +
          (missing.includes("bikeBrand") ? "- ماركة الدراجة (Yamaha, Honda...)\n" : "") +
          (missing.includes("bikeModel") ? "- موديل الدراجة (R3, CBR500...)\n" : "") +
          (missing.includes("bikeYear") ? "- سنة الموديل\n" : "") +
          (missing.includes("partName") ? "- اسم أو وصف القطعة المطلوبة\n" : "")
      );
    } else {
      replyParts.push(
        "To give you precise spare part links, please share as much as possible of:\n" +
          (missing.includes("bikeType") ? "- Bike type (sport / cruiser / scooter / adventure)\n" : "") +
          (missing.includes("bikeBrand") ? "- Brand (Yamaha, Honda...)\n" : "") +
          (missing.includes("bikeModel") ? "- Model (R3, CBR500...)\n" : "") +
          (missing.includes("bikeYear") ? "- Year model\n" : "") +
          (missing.includes("partName") ? "- Name or description of the part\n" : "")
      );
    }
  } else {
    // لو كل المعلومات مكتملة، نخلي الرد النهائي يتعدل لاحقاً في مكان آخر بإضافة رابط أمازون
    replyParts.push(t.sparePartNextStep);
  }

  return {
    category: "spare-part",
    itemType: "spare-part",
    bikeType: bikeType || null,
    bikeBrand: brand,
    bikeModel: model || null,
    bikeYear: year || null,
    partName: partName || null,
    missingInfo: missing,
    reply: replyParts.join("\n\n"),
  };
}

// منطق الرد في حالة الإكسسوارات
function handleAccessoryFlow(message, lang, context) {
  const t = T(lang);

  const usage = detectUsage(message, context) || context.usage;
  const bikeType = detectBikeType(message, context) || context.bikeType;

  let replyParts = [
    t.welcomeLine,
    t.genericIntro,
    t.askAccessory,
    t.accessoryUsage,
  ];

  const missing = [];
  if (!usage) missing.push("usage");
  if (!bikeType) missing.push("bikeType");

  return {
    category: "accessory",
    itemType: context.itemType || null,
    bikeType: bikeType || null,
    usage: usage || null,
    missingInfo: missing,
    reply: replyParts.join("\n\n"),
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

    // 1) جلب ملف المشتريات (ذاكرة قوية)
    let existingProfile = null;
    let memoryContext = {};

    if (MONGODB_URI && mongoose.connection.readyState === 1) {
      existingProfile = await PurchaseProfile.findOne({ userId: profileUserId });

      if (existingProfile) {
        memoryContext = {
          category: existingProfile.lastCategory || undefined,
          itemType: existingProfile.lastItemType || undefined,
          bikeType: existingProfile.preferredBikeType || undefined,
          usage: existingProfile.lastUsage || undefined,
          bikeBrand: existingProfile.lastBikeBrand || undefined,
          bikeModel: existingProfile.lastBikeModel || undefined,
          bikeYear: existingProfile.lastBikeYear || undefined,
          partName: existingProfile.lastPartName || undefined,
        };
      }
    }

    // 2) دمج الذاكرة مع الـ context الحالي (الجديد يغلّب القديم)
    const mergedContext = {
      ...memoryContext,
      ...context,
    };

    // 3) تحليل الرسالة باستخدام الـ mergedContext
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
        bikeType: mergedContext.bikeType || null,
        usage: mergedContext.usage || null,
        missingInfo: ["category"],
        reply: `${t.welcomeLine}\n\n${t.genericIntro}\n\n${t.fallback}`,
      };
    }

    // 4) منطق البحث عن المنتجات / الروابط
    let productSearch = null;
    let amazonSearch = null;

    // 4-أ) معدات السلامة: خوذة / جاكيت / قفازات / بوت
    if (
      result.category === "safety" &&
      result.usage &&
      result.bikeType &&
      result.missingInfo &&
      result.missingInfo.length === 0 &&
      result.itemType
    ) {
      let productCategory = null;

      if (result.itemType.startsWith("helmet")) {
        productCategory = "helmet-fullface";
      } else if (result.itemType === "jacket") {
        productCategory = "jacket";
      } else if (result.itemType === "gloves") {
        productCategory = "gloves";
      } else if (result.itemType === "boots") {
        productCategory = "boots";
      }

      if (productCategory) {
        // رابط بحث Amazon حسب السياق
        amazonSearch = buildAmazonSearchLinkFromContext({
          category: result.category,
          itemType: result.itemType,
          usage: result.usage,
          bikeType: result.bikeType,
          brand: result.bikeBrand,
          model: result.bikeModel,
          partName: result.partName,
          lang,
        });

        // بحث في القائمة الداخلية
        productSearch = searchProducts({
          category: productCategory,
          usage: result.usage,
          bikeType: result.bikeType,
        });

        if (productSearch && productSearch.results && productSearch.results.length) {
          const lines = [];

          productSearch.results.forEach((product, idx) => {
            let labelText;
            if (lang === "ar") {
              if (product.label === "cheapest") labelText = "أرخص خيار";
              else if (product.label === "best_value")
                labelText = "أفضل قيمة مقابل السعر";
              else if (product.label === "premium") labelText = "أعلى جودة";
              else labelText = "خيار مقترح";
            } else {
              if (product.label === "cheapest") labelText = "Cheapest option";
              else if (product.label === "best_value") labelText = "Best value";
              else if (product.label === "premium") labelText = "Top quality";
              else labelText = "Suggested option";
            }

            if (lang === "ar") {
              lines.push(
                `\n${idx + 1}) ${labelText}\n${product.name} (${product.brand})\nالمتجر: ${product.store}\nالسعر التقريبي: ${product.priceUSD} ${product.currency}\nالرابط: ${product.url}`
              );
            } else {
              lines.push(
                `\n${idx + 1}) ${labelText}\n${product.name} (${product.brand})\nStore: ${product.store}\nApprox. price: ${product.priceUSD} ${product.currency}\nLink: ${product.url}`
              );
            }
          });

          const usageText = usageLabel(result.usage, lang);
          const bikeTypeText = bikeTypeLabel(result.bikeType, lang);

          let itemText;
          if (productCategory === "helmet-fullface") {
            itemText =
              helmetLabel(result.itemType, lang) ||
              (lang === "ar" ? "خوذة" : "helmet");
          } else if (productCategory === "jacket") {
            itemText = lang === "ar" ? "جاكيت حماية" : "riding jacket";
          } else if (productCategory === "gloves") {
            itemText = lang === "ar" ? "قفازات حماية" : "riding gloves";
          } else if (productCategory === "boots") {
            itemText = lang === "ar" ? "بوت/حذاء ركوب" : "riding boots";
          }

          let detailParts = [];
          if (itemText) detailParts.push(itemText);
          if (usageText)
            detailParts.push(
              lang === "ar" ? `مناسبة لـ ${usageText}` : `for ${usageText}`
            );
          if (bikeTypeText)
            detailParts.push(
              lang === "ar" ? `على ${bikeTypeText}` : `on a ${bikeTypeText}`
            );

          let introLine;
          if (lang === "ar") {
            const detailSentence =
              detailParts.length > 0
                ? `جهّزت لك 3 خيارات ${detailParts.join(
                    " ، "
                  )}, مرتّبة حسب الأفضلية:`
                : "جهّزت لك 3 خيارات مناسبة، مرتّبة حسب الأفضلية:";
            introLine = `تمام، صار عندي صورة واضحة عن احتياجك 👌\n${detailSentence}`;
          } else {
            const detailSentence =
              detailParts.length > 0
                ? `I prepared 3 options ${detailParts.join(
                    " "
                  )} ranked for you:`
                : "I prepared 3 suitable options ranked for you:";
            introLine = `Great, I now have a clear understanding of your needs 👌\n${detailSentence}`;
          }

          const amazonLine =
            amazonSearch && amazonSearch.url
              ? lang === "ar"
                ? `🔍 رابط بحث Amazon حسب طلبك:\n${amazonSearch.url}`
                : `🔍 Amazon search link for your request:\n${amazonSearch.url}`
              : "";

          result.reply =
            amazonLine && amazonLine.length
              ? `${introLine}\n\n${amazonLine}\n\n${lines.join("\n")}`
              : `${introLine}\n\n${lines.join("\n")}`;
        }
      }
    }

    // 4-ب) قطع الغيار: عندما تكون كل البيانات الأساسية متوفرة
    if (
      result.category === "spare-part" &&
      result.partName &&
      result.bikeBrand &&
      result.bikeModel &&
      result.bikeYear &&
      (!result.missingInfo || result.missingInfo.length === 0)
    ) {
      amazonSearch = buildAmazonSearchLinkFromContext({
        category: "spare-part",
        itemType: "spare-part",
        usage: result.usage,
        bikeType: result.bikeType,
        brand: result.bikeBrand,
        model: result.bikeModel,
        year: result.bikeYear,
        partName: result.partName,
        lang,
      });

      const bikeDesc =
        lang === "ar"
          ? `${result.bikeBrand} ${result.bikeModel} موديل ${result.bikeYear}`
          : `${result.bikeBrand} ${result.bikeModel} (${result.bikeYear})`;

      const lineHeader =
        lang === "ar"
          ? `ممتاز، صار عندي بيانات كافية عن دراجتك:\n- ${bikeDesc}\n- القطعة المطلوبة: ${result.partName}`
          : `Great, I now have enough info about your bike:\n- ${bikeDesc}\n- Requested part: ${result.partName}`;

      const amazonLine =
        amazonSearch && amazonSearch.url
          ? lang === "ar"
            ? `🔍 هذا رابط بحث مخصص على Amazon حسب طلبك:\n${amazonSearch.url}\n\n*ملاحظة:* تأكد دائماً من توافق رقم القطعة مع موديل وسنة دراجتك قبل الشراء.`
            : `🔍 Here is a tailored Amazon search link based on your request:\n${amazonSearch.url}\n\n*Note:* Always double-check that the part number is compatible with your bike model and year before purchasing.`
          : "";

      result.reply = `${T(lang).welcomeLine}\n\n${lineHeader}\n\n${amazonLine}`;
    }

    // 4-ج) الإكسسوارات: عندما تتوفر بيانات الاستخدام ونوع الدراجة
    if (
      result.category === "accessory" &&
      result.usage &&
      result.bikeType &&
      (!result.missingInfo || result.missingInfo.length === 0)
    ) {
      // استخدام منطق productSearch الجديد للإكسسوارات
      productSearch = searchProducts({
        category: "accessory",
        usage: result.usage,
        bikeType: result.bikeType,
      });

      if (productSearch && productSearch.url) {
        amazonSearch = {
          query: productSearch.query,
          url: productSearch.url,
        };

        const usageText = usageLabel(result.usage, lang);
        const bikeTypeText = bikeTypeLabel(result.bikeType, lang);

        let header;
        if (lang === "ar") {
          header =
            "ممتاز، صار عندي فكرة واضحة عن نوع الإكسسوارات اللي تناسب استخدامك ودراجتك.";
        } else {
          header =
            "Great, I now have a clear idea about the accessories that fit your bike and usage.";
        }

        const details =
          lang === "ar"
            ? `- نوع الاستخدام: ${usageText || "غير محدد"}\n- نوع الدراجة: ${bikeTypeText || "غير محدد"}`
            : `- Usage: ${usageText || "not specified"}\n- Bike type: ${bikeTypeText || "not specified"}`;

        const amazonLine =
          lang === "ar"
            ? `🔍 هذا رابط بحث مخصص على Amazon للإكسسوارات المناسبة:\n${amazonSearch.url}`
            : `🔍 Here is a tailored Amazon search link for suitable accessories:\n${amazonSearch.url}`;

        result.reply = `${T(lang).welcomeLine}\n\n${header}\n\n${details}\n\n${amazonLine}`;
      }
    }

    // 5) تحديث ملف المشتريات في MongoDB
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

    // 6) إرسال الرد
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
      products:
        productSearch && productSearch.results
          ? productSearch.results
          : [],
      amazonSearch:
        amazonSearch && amazonSearch.url
          ? {
              query: amazonSearch.query,
              url: amazonSearch.url,
            }
          : null,
      debug: {
        receivedMessage: message,
        receivedLang: lang,
        receivedUserId: profileUserId,
        receivedContext: context || null,
        mergedContextFromMemory: memoryContext,
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Rider Purchases Bot running on port ${PORT} (bound on 0.0.0.0)`
  );
});

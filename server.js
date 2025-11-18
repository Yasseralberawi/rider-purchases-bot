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

  // ✅ أولوية للي مكتوب في الرسالة الحالية، بعدين نرجع لذاكرة الـ context
  let itemType = null;

  if (helmetTypeDetected || mentionsHelmet) {
    itemType = helmetTypeDetected || "helmet-unknown";
  } else if (mentionsJacket) {
    itemType = "jacket";
  } else if (mentionsGloves) {
    itemType = "gloves";
  } else if (mentionsBoots) {
    itemType = "boots";
  } else if (context.itemType) {
    itemType = context.itemType;
  }

  const bikeType = detectBikeType(message, context) || context.bikeType;
  const usage = detectUsage(message, context) || context.usage;

  const missing = [];

  // نحتاج usage + bikeType لكل معدات السلامة
  if (!usage) missing.push("usage");
  if (!bikeType) missing.push("bikeType");

  // لو خوذة والـ type غير محدد بوضوح
  if (
    (!helmetTypeDetected && (mentionsHelmet || itemType === "helmet-unknown"))
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

// (🔻 باقي الكود كما هو تماماً عندك: handleSparePartFlow, handleAccessoryFlow,
//   /api/chat/purchases, وتشغيل السيرفر… بدون أي تعديل آخر)

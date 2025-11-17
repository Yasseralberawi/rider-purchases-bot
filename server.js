// server.js
// Backend مستقل - بوت رايدر المشتريات
// MongoDB + ملف مشتريات لكل عميل + ذاكرة قوية + اختيار أفضل 3 منتجات + رد ديناميكي + رابط بحث Amazon

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

// منطق اختيار المنتجات من القائمة الداخلية
const { selectTop3Products } = require("./logic/productSearch");
// خدمة بناء رابط بحث Amazon حسب السياق
const {
  buildAmazonSearchLinkFromContext,
} = require("./services/amazonSearch");

const app = express();

// ===== إعدادات أساسية =====
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
    lastItemType: { type: String, default: null }, // helmet-fullface / spare-part / accessory-xxx

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
      : "Got it, you're looking for a spare part.\nTo help accurately I need:\n1) Bike type (sport, cruiser, scooter, adventure)\n2) Brand & model (e.g. Yamaha R3, Honda CBR500)\n3) Year model\n4) The exact part you need (e.g. front brake pads, oil filter, chain...).",
    sparePartNextStep: isAr
      ? "اكتب المعلومات اللي تعرفها من النقاط اللي فوق، حتى لو ما كانت كاملة، وأنا أرتب لك الخيارات وأبحث عن أفضل موقع مناسب."
      : "Please type the info you know from the points above (even if not complete) and I’ll narrow down the options and find the best site.",
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

// helpers لتحويل القيم المختصرة إلى نص عربي/إنجليزي
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
    "قفازات",
    "قلفز",
    "gloves",
    "بوت",
    "جزمة",
    "boots",
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

// منطق الرد في حالة معدات السلامة
function handleSafetyFlow(message, lang, context) {
  const t = T(lang);
  const helmetType = detectHelmetType(message, context) || context.itemType;
  const bikeType = detectBikeType(message, context) || context.bikeType;
  const usage = detectUsage(message, context) || context.usage;

  const missing = [];
  if (!helmetType) missing.push("helmetType");
  if (!usage) missing.push("usage");
  if (!bikeType) missing.push("bikeType");

  let replyParts = [t.welcomeLine];

  const msg = message.toLowerCase();
  const mentionsHelmet =
    msg.includes("خوذة") ||
    msg.includes("خودة") ||
    msg.includes("helmet") ||
    (context.itemType && context.itemType.startsWith("helmet"));

  // جملة شخصية مبنية على الذاكرة
  const helmetText = helmetLabel(helmetType, lang);
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
    // نسأل فقط عن الناقص
    if (!helmetType) replyParts.push(t.askHelmetType);
    if (!usage) replyParts.push(t.askUsage);
    if (!bikeType) replyParts.push(t.askBikeTypeForSafety);

    if (missing.length === 0) {
      replyParts.push(
        t.safetyAlmostReady +
          (lang === "ar"
            ? "\nبعدها أقدر أجهز لك ترشيحات وروابط لأفضل الأسعار."
            : "\nThen I can prepare recommendations and links with the best prices.")
      );
    }
  } else {
    replyParts.push(
      lang === "ar"
        ? "واضح أنك تبحث عن معدات سلامة للدراجة (مثل خوذة، جاكيت، قفازات أو غيرها).\nحدد لي أكثر: شو نوع القطعة اللي في بالك؟"
        : "It seems you're looking for safety gear (helmet, jacket, gloves, etc.).\nTell me which item you have in mind."
    );
  }

  return {
    category: "safety",
    itemType: helmetType || (mentionsHelmet ? "helmet-unknown" : null),
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
  const brand = context.bikeBrand || null;
  const model = context.bikeModel || null;
  const year = context.bikeYear || null;

  const msg = message.toLowerCase();

  let partName = context.partName || null;
  if (!partName) {
    if (msg.includes("فلتر")) partName = "فلتر";
    else if (msg.includes("تيل") || msg.includes("pads")) partName = "تيل فرامل";
    else if (msg.includes("جنزير") || msg.includes("chain")) partName = "جنزير";
  }

  const missing = [];
  if (!bikeType) missing.push("bikeType");
  if (!brand) missing.push("bikeBrand");
  if (!model) missing.push("bikeModel");
  if (!year) missing.push("bikeYear");
  if (!partName) missing.push("partName");

  let replyParts = [
    t.welcomeLine,
    t.genericIntro,
    t.askSparePartCore,
    t.sparePartNextStep,
  ];

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

    // 4) لو المعلومات مكتملة لخوذة → نبحث عن أفضل 3 منتجات ونبني رد ديناميكي + رابط Amazon
    let productSearch = null;
    let amazonSearch = null;

    if (
      result.category === "safety" &&
      result.itemType &&
      result.itemType.startsWith("helmet") &&
      result.usage &&
      result.bikeType &&
      result.missingInfo &&
      result.missingInfo.length === 0
    ) {
      // 🔹 توليد رابط بحث Amazon مبني على السياق
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

      // 🔹 استخدام القائمة الداخلية لاختيار 3 منتجات (LS2 / HJC / Shoei ...)
      productSearch = selectTop3Products({
        category: "safety",
        itemType: "helmet-fullface", // حالياً نركز على فل فيس كبداية
        usage: result.usage,
        bikeType: result.bikeType,
      });

      if (productSearch && productSearch.items && productSearch.items.length) {
        const lines = [];

        productSearch.items.forEach(({ label, product }, idx) => {
          let labelText;
          if (lang === "ar") {
            if (label === "cheapest") labelText = "أرخص خيار";
            else if (label === "best_value") labelText = "أفضل قيمة مقابل السعر";
            else if (label === "premium") labelText = "أعلى جودة";
            else labelText = "خيار مقترح";
          } else {
            if (label === "cheapest") labelText = "Cheapest option";
            else if (label === "best_value") labelText = "Best value";
            else if (label === "premium") labelText = "Top quality";
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

        // نص ديناميكي حسب نوع الخوذة + الاستخدام + نوع الدراجة
        const helmetText =
          helmetLabel(result.itemType, lang) || (lang === "ar" ? "خوذة" : "helmet");
        const usageText = usageLabel(result.usage, lang);
        const bikeTypeText = bikeTypeLabel(result.bikeType, lang);

        let introLine;
        if (lang === "ar") {
          let detailParts = [];
          if (helmetText) detailParts.push(helmetText);
          if (usageText) detailParts.push(`مناسبة لـ ${usageText}`);
          if (bikeTypeText) detailParts.push(`على ${bikeTypeText}`);

          const detailSentence =
            detailParts.length > 0
              ? `جهّزت لك 3 خيارات ${detailParts.join(" ، ")}، مرتّبة حسب الأفضلية:`
              : "جهّزت لك 3 خيارات مناسبة، مرتّبة حسب الأفضلية:";

          introLine = `تمام، صار عندي صورة واضحة عن احتياجك 👌\n${detailSentence}`;
        } else {
          let detailParts = [];
          if (helmetText) detailParts.push(helmetText);
          if (usageText) detailParts.push(`for ${usageText}`);
          if (bikeTypeText) detailParts.push(`on a ${bikeTypeText}`);

          const detailSentence =
            detailParts.length > 0
              ? `I prepared 3 options ${detailParts.join(" ")} ranked for you:`
              : "I prepared 3 suitable options ranked for you:";

          introLine = `Great, I now have a clear understanding of your needs 👌\n${detailSentence}`;
        }

        // إدخال رابط بحث Amazon في أعلى الاقتراحات
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
        productSearch && productSearch.items
          ? productSearch.items.map(({ label, product }) => ({
              label,
              id: product.id,
              name: product.name,
              brand: product.brand,
              store: product.store,
              priceUSD: product.priceUSD,
              currency: product.currency,
              url: product.url,
              qualityTier: product.qualityTier,
            }))
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

app.listen(PORT, () => {
  console.log(`🚀 Rider Purchases Bot running on port ${PORT}`);
});

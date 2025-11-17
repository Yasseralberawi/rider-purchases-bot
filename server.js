// server.js
// Backend مستقل - بوت رايدر المشتريات (مع MongoDB + ملف مشتريات لكل عميل)

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// ===== إعدادات أساسية =====
const PORT = process.env.PORT || 5050;

// ==============================
// اتصال MongoDB
// ==============================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI غير موجود في المتغيرات البيئية. الاتصال بقاعدة البيانات لن يعمل.");
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("✅ متصل بقاعدة بيانات MongoDB بنجاح (رايدر المشتريات).");
    })
    .catch((err) => {
      console.error("❌ فشل الاتصال بـ MongoDB في رايدر المشتريات:", err.message);
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
   دوال مساعدة بسيطة للذكاء في الرد
   ===================================== */

// ترجمة ثابتة حسب اللغة
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
      ? "واضح إنك تدور على إكسسوار للدراجة.\nحاب أعرف نوع الإكسسوار ووين رح يُركّب بالضبط (مثلاً: حامل جوال على المقود، شنطة خلفية، شنطة خزان...)."
      : "It looks like you're looking for an accessory.\nI need to know what type of accessory and where it will be mounted (e.g. phone mount on handlebar, rear bag, tank bag...).",
    accessoryUsage: isAr
      ? "برضه يساعدني أعرف هل الاستخدام أكثر للمدينة، سفر طويل، أو أدفنشر، عشان أوازن بين الراحة والمتانة والسعر."
      : "It also helps to know if you ride mostly in the city, long-distance touring, or adventure, so I can balance comfort, durability, and price.",
    fallback: isAr
      ? "فهمت طلبك بشكل عام، لكن عشان أقدر أساعدك صح، اشرح لي أكثر: هل اللي تحتاجه يندرج تحت معدات السلامة، قطع غيار، أو إكسسوارات للدراجة؟"
      : "I understand your request in general, but to help you properly, please clarify: Is this about safety gear, spare parts, or accessories?",
  };
}

// كشف الكاتيجوري من الرسالة أو الـ context
function detectCategory(message = "", context = {}) {
  if (context.category) return context.category; // لو الواجهة محددته مسبقاً

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

  if (msg.includes("helmet")) {
    // خوذة بدون تحديد نوع
    return null;
  }

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

// منطق الرد في حالة معدات السلامة (خوذة / جاكيت ...الخ)
function handleSafetyFlow(message, lang, context) {
  const t = T(lang);
  const helmetType = detectHelmetType(message, context);
  const bikeType = detectBikeType(message, context);
  const usage = detectUsage(message, context);

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

  if (mentionsHelmet) {
    replyParts.push(t.genericIntro);

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

  const bikeType = detectBikeType(message, context);
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

  let replyParts = [t.welcomeLine, t.genericIntro, t.askSparePartCore, t.sparePartNextStep];

  return {
    category: "spare-part",
    itemType: "spare-part",
    bikeType: bikeType || null,
    bikeBrand: brand,
    bikeModel: model,
    bikeYear: year,
    partName: partName,
    missingInfo: missing,
    reply: replyParts.join("\n\n"),
  };
}

// منطق الرد في حالة الإكسسوارات
function handleAccessoryFlow(message, lang, context) {
  const t = T(lang);

  const usage = detectUsage(message, context);
  const bikeType = detectBikeType(message, context);

  let replyParts = [t.welcomeLine, t.genericIntro, t.askAccessory, t.accessoryUsage];

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
    const category = detectCategory(message, context);

    let result;

    if (category === "safety") {
      result = handleSafetyFlow(message, lang, context);
    } else if (category === "spare-part") {
      result = handleSparePartFlow(message, lang, context);
    } else if (category === "accessory") {
      result = handleAccessoryFlow(message, lang, context);
    } else {
      result = {
        category: null,
        itemType: null,
        bikeType: null,
        usage: null,
        missingInfo: ["category"],
        reply: `${t.welcomeLine}\n\n${t.genericIntro}\n\n${t.fallback}`,
      };
    }

    // =========================
    // تخزين ملف المشتريات في MongoDB
    // =========================
    if (MONGODB_URI && mongoose.connection.readyState === 1) {
      const profileUserId = userId || "guest";

      const profileUpdate = {
        lastCategory: result.category || null,
        lastItemType: result.itemType || null,
        lastBikeBrand: result.bikeBrand || null,
        lastBikeModel: result.bikeModel || null,
        lastBikeYear: result.bikeYear || null,
        lastPartName: result.partName || null,
      };

      if (result.bikeType) {
        profileUpdate.preferredBikeType = result.bikeType;
      }
      if (result.usage) {
        profileUpdate.lastUsage = result.usage;
      }

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
    } else {
      if (!MONGODB_URI) {
        console.warn("⚠️ لم يتم تخزين الملف لأن MONGODB_URI غير مضبوط.");
      } else {
        console.warn(
          "⚠️ لم يتم تخزين الملف لأن اتصال MongoDB غير جاهز (readyState != 1)."
        );
      }
    }

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
      debug: {
        receivedMessage: message,
        receivedLang: lang,
        receivedUserId: userId || null,
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

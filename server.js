// server.js
// Backend مستقل - بوت رايدر المشتريات (نسخة مبسطة تعتمد على OpenAI)
// الفكرة: العميل يحكي مع OpenAI كمستشار مشتريات، ونحن نضيف له رابط Amazon مع tag=ridermall-20

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

const OpenAI = require("openai");

// تأكد أن متغير البيئة موجود في Render: OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 5050;

// ==============================
// اتصال MongoDB (اختياري - فقط لتخزين تاريخ بسيط)
// ==============================
const MONGODB_URI = process.env.MONGODB_URI;

let PurchaseProfile = null;

if (!MONGODB_URI) {
  console.warn(
    "⚠️ MONGODB_URI غير موجود في المتغيرات البيئية. الاتصال بقاعدة البيانات لن يعمل."
  );
} else {
  const purchaseProfileSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true, index: true },
      history: [
        {
          message: String,
          reply: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },
    { timestamps: true }
  );

  PurchaseProfile =
    mongoose.models.PurchaseProfile ||
    mongoose.model("PurchaseProfile", purchaseProfileSchema);

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
   دوال مساعدة
   ===================================== */

// ترجمة بسيطة
function T(lang = "ar") {
  const isAr = lang === "ar";

  return {
    botName: isAr ? "رايدر المشتريات" : "Rider Purchases",
    systemPrompt: isAr
      ? `أنت "رايدر المشتريات" مستشار مشتريات محترف تابع لمنصة Rider Mall في قطر.
تخصصك: معدات السلامة، الإكسسوارات، وقطع الغيار للدراجات النارية، مع فهم للسوق العالمي (خصوصاً Amazon).
تكلّم باللغة العربية الفصحى البسيطة، بأسلوب محترم وعملي، وكأنك خبير مبيعات في محل كبير.

القواعد:
- اسأل أسئلة بسيطة لو احتجت توضح طلب العميل (نوع الدراجة، نوع الاستخدام، الميزانية، البراند المفضلة...).
- لا تذكر أنك نموذج ذكاء اصطناعي، عرّف نفسك دائماً كمستشار مشتريات.
- ركّز على النصيحة: ماذا يشتري؟ ما هي النقاط المهمة (السلامة، الجودة، المقاس، الملائمة للمناخ في الخليج إن أمكن).
- لا تضع روابط في ردّك، ولا تذكر Amazon أو كود الشراكة. هذه الأمور يضيفها الباك إند بعدين.
- الرد يكون مختصر، واضح، ومنظم بنقاط عند الحاجة.`
      : `You are "Rider Purchases", a professional motorcycle gear and parts advisor for Rider Mall in Qatar.
You help riders choose helmets, jackets, gloves, boots, accessories and spare parts.
Speak in simple, clear English, like an expert salesman in a big motorcycle store.

Rules:
- Ask a couple of short clarifying questions if needed (bike type, usage, budget, preferred brands...).
- Don't say you're an AI model, always act as a human expert advisor.
- Focus on recommendations and what to look for (safety, quality, fit, climate suitability).
- Do NOT include any links or mention Amazon or affiliate tags. Backend will add links.
- Keep replies concise, structured, and practical.`,
  };
}

// بناء رابط أمازون بسيط من نص طلب العميل
function buildSimpleAmazonSearch(message, lang = "ar") {
  const base = "https://www.amazon.com/s?k=";
  const tag = process.env.AMAZON_ASSOC_TAG || "ridermall-20";

  // نستخدم نص الرسالة كما هو للبحث (Amazon يدعم عربي وإنجليزي)
  const q = encodeURIComponent(message.trim().replace(/\s+/g, " "));

  return {
    query: message,
    url: `${base}${q}&tag=${tag}`,
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
    const { message, lang = "ar", userId, history } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "الرسالة مطلوبة (message) ويجب أن تكون نص.",
      });
    }

    const t = T(lang);
    const profileUserId = userId || "guest";

    // ===== 1) تحضير سياق المحادثة لـ OpenAI =====
    const messagesForOpenAI = [
      {
        role: "system",
        content: t.systemPrompt,
      },
    ];

    // لو أرسلت من الفرونت هيستوري، نضيفه (اختياري، تقدر تتركه فاضي)
    if (Array.isArray(history)) {
      history.forEach((m) => {
        if (!m || !m.text) return;
        messagesForOpenAI.push({
          role: m.from === "user" ? "user" : "assistant",
          content: m.text,
        });
      });
    }

    // آخر رسالة من العميل
    messagesForOpenAI.push({
      role: "user",
      content: message,
    });

    // ===== 2) استدعاء OpenAI =====
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesForOpenAI,
      temperature: 0.5,
    });

    const aiReply =
      completion.choices?.[0]?.message?.content ||
      (lang === "ar"
        ? "حدث خطأ أثناء توليد الرد."
        : "An error occurred while generating the reply.");

    // ===== 3) بناء رابط Amazon بسيط من نص طلب العميل =====
    const amazonSearch = buildSimpleAmazonSearch(message, lang);

    // ===== 4) حفظ التاريخ في Mongo (اختياري) =====
    if (PurchaseProfile && MONGODB_URI && mongoose.connection.readyState === 1) {
      await PurchaseProfile.findOneAndUpdate(
        { userId: profileUserId },
        {
          $push: {
            history: {
              message,
              reply: aiReply,
            },
          },
        },
        { upsert: true, new: true }
      );
    }

    // ===== 5) إرسال الرد للفرونت =====
    return res.json({
      ok: true,
      botName: t.botName,
      reply: aiReply,
      amazonSearch: amazonSearch,
      // باقي الحقول خالية حالياً (مش محتاجينها)
      category: null,
      itemType: null,
      bikeType: null,
      bikeBrand: null,
      bikeModel: null,
      bikeYear: null,
      usage: null,
      partName: null,
      missingInfo: [],
      debug: {
        receivedMessage: message,
        receivedLang: lang,
        receivedUserId: profileUserId,
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

// server.js
// Backend مستقل - بوت رايدر المشتريات

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();

// ===== إعدادات أساسية =====
const PORT = process.env.PORT || 5050;

// Middlewares أساسية
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: "*", // لاحقاً ممكن نحدده على دومين Rider Mall
  })
);
app.use(helmet());
app.use(morgan("dev"));

// ===== Health Check =====
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Rider Purchases Bot",
    message: "رايدر المشتريات يعمل بنجاح ✅",
  });
});

// ===== Endpoint مبدئي للدردشة =====
// لاحقاً رح نربطه بالذكاء الاصطناعي وبحث المواقع
app.post("/api/chat/purchases", async (req, res) => {
  try {
    const { message, userId, bikeInfo } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "الرسالة مطلوبة (message) ويجب أن تكون نص.",
      });
    }

    return res.json({
      ok: true,
      botName: "رايدر المشتريات",
      reply:
        "أهلاً بك، أنا رايدر المشتريات 👋\n" +
        "هذا رد تجريبي للتأكد أن البوت يعمل.\n" +
        "لاحقاً سنضيف البحث عن أرخص مواقع قطع الغيار والإكسسوارات.",
      debug: {
        receivedMessage: message,
        receivedUserId: userId || null,
        receivedBikeInfo: bikeInfo || null,
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

// ===== تشغيل السيرفر =====
app.listen(PORT, () => {
  console.log(`🚀 Rider Purchases Bot running on port ${PORT}`);
});

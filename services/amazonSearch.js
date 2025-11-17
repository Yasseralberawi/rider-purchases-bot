// services/amazonSearch.js
// خدمة مساعدة لبناء روابط بحث Amazon (مع Affiliate Tag) بناءً على وصف المنتج والسياق

/**
 * توليد نص البحث في أمازون بناءً على نوع المنتج والاستخدام والدراجة
 * هذا لا يعتمد على API، فقط يبني جملة ذكية للبحث.
 */
function buildAmazonQueryFromContext({
  category,
  itemType,
  usage,
  bikeType,
  brand,
  model,
  partName,
  freeText,
  lang = "ar",
}) {
  const parts = [];

  // نوع المنتج الأساسي
  if (category === "safety") {
    if (itemType && itemType.startsWith("helmet")) {
      parts.push("motorcycle helmet");
    } else if (itemType === "jacket") {
      parts.push("motorcycle jacket");
    } else if (itemType === "gloves") {
      parts.push("motorcycle gloves");
    } else if (itemType === "boots") {
      parts.push("motorcycle boots");
    } else {
      parts.push("motorcycle gear");
    }
  } else if (category === "spare-part") {
    parts.push("motorcycle spare part");
    if (partName) parts.push(partName);
  } else if (category === "accessory") {
    parts.push("motorcycle accessory");
    if (partName) parts.push(partName);
  }

  // البراند والموديل إن وجدت
  if (brand) parts.push(brand);
  if (model) parts.push(model);

  // نوع الدراجة (Sport / Cruiser / Scooter / Adventure)
  if (bikeType) {
    if (bikeType === "sport") parts.push("sport bike");
    else if (bikeType === "cruiser") parts.push("cruiser");
    else if (bikeType === "scooter") parts.push("scooter");
    else if (bikeType === "adventure") parts.push("adventure bike");
  }

  // الاستخدام (مدينة / سفر / أدفنشر) – مفيدة للخوذ والجاكيت
  if (usage) {
    if (usage === "touring") parts.push("touring");
    else if (usage === "city") parts.push("city riding");
    else if (usage === "adventure") parts.push("adventure / offroad");
  }

  // freeText من البوت لو حابين نضيف وصف إضافي
  if (freeText) parts.push(freeText);

  // نضمن وجود شيء واحد على الأقل
  if (!parts.length) {
    parts.push("motorcycle");
  }

  return parts.join(" ");
}

/**
 * بناء رابط بحث Amazon مع Affiliate Tag
 * يعتمد على متغير البيئة:
 * - AMAZON_ASSOCIATE_TAG أو AMAZON_AFFILIATE_TAG
 */
function buildAmazonSearchUrlFromQuery(query) {
  const baseUrl = "https://www.amazon.com/s";
  const params = new URLSearchParams();

  params.set("k", query);

  const tag =
    process.env.AMAZON_ASSOCIATE_TAG || process.env.AMAZON_AFFILIATE_TAG || "";
  if (tag) {
    params.set("tag", tag);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * واجهة جاهزة للاستخدام:
 * تستقبل سياق الطلب وترجع:
 * - query المستخدم
 * - رابط Amazon جاهز بالـ Affiliate Tag
 */
function buildAmazonSearchLinkFromContext(ctx) {
  const query = buildAmazonQueryFromContext(ctx);
  const url = buildAmazonSearchUrlFromQuery(query);

  return {
    query,
    url,
  };
}

module.exports = {
  buildAmazonQueryFromContext,
  buildAmazonSearchUrlFromQuery,
  buildAmazonSearchLinkFromContext,
};

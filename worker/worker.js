// Source for the Cloudflare Worker "food-assistant-ai" used by صحن (POST /ask).
// Deployed separately from GitHub Pages. The AI runs through the Workers AI
// binding named "AI", so no API key is stored in this repository.
//
// Change in this version: when a photo is sent, the vision model is asked for
// one entry per visible food item (`items`). The front end still accepts the
// older response shape (no `items`) and treats it as a single item.

const MODEL = "@cf/zai-org/glm-4.7-flash";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_CHARS = 1000000;
const MAX_ITEMS = 15;

const ALLOWED_ORIGIN = "https://mohammedtareqabugosh-maker.github.io";

const VISION_ITEMS_INSTRUCTIONS = `

الصورة مرفقة مع الطلب. عدّد كل صنف طعام ظاهر فيها على حدة، وأعد JSON فقط بالشكل:
{"reply":"شرح مختصر","items":[{"name":"اسم الصنف","portion":"الكمية المقدرة مثل 150 غ","grams":0,"calories":0,"protein":0,"carbs":0,"fat":0,"confidence":0.0}],"assumptions":"الافتراضات"}
- confidence رقم بين 0 و1 يعبّر عن ثقتك في التعرف على الصنف.
- إذا لم تتمكن من تحديد صنف بثقة فلا تخترع له قيمًا؛ اذكره في assumptions.
- الأوزان والقيم تقديرية من الصورة وليست دقيقة.
- لا تحسب الزيوت أو الصلصات المخفية كأنها مؤكدة.`;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  };
}

function reply(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

function extractJSON(value) {
  if (typeof value !== "string") {
    if (value && typeof value === "object") return value;
    throw new Error("رد النموذج فارغ");
  }
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  throw new Error("الرد ليس بصيغة JSON");
}

function nonNegative(value) {
  return Math.max(0, Number(value) || 0);
}

// Keeps only well-formed items and clamps every number, so the client can trust the shape.
function normalizeItems(list) {
  return list.slice(0, MAX_ITEMS).map(item => {
    const confidence = Number(item?.confidence);
    return {
      name: String(item?.name || "").trim().slice(0, 120),
      portion: String(item?.portion || "").trim().slice(0, 60),
      grams: nonNegative(item?.grams),
      calories: nonNegative(item?.calories),
      protein: nonNegative(item?.protein),
      carbs: nonNegative(item?.carbs),
      fat: nonNegative(item?.fat),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null
    };
  }).filter(item => item.name);
}

// Vision path: Llama 3.2 Vision takes a plain `prompt` plus the image bytes.
// It does not accept the chat `messages` format, which made every photo request fail.
async function describeWithVision(env, prompt, dataUrl) {
  const m = /^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error("صيغة الصورة غير مدعومة");
  const bin = atob(m[1]);
  const bytes = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return env.AI.run(VISION_MODEL, {
    prompt: "أنت مساعد غذائي. أعد JSON صالحًا فقط.\n\n" + prompt + "\n\nالصورة مرفقة مع الطلب: حدّد الأكلة الظاهرة وكميتها التقريبية، واذكر في الافتراضات أن التقدير من الصورة.",
    image: bytes,
    max_tokens: 1200,
    temperature: 0.3,
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return reply({ ok: true, service: "food-assistant-ai", model: MODEL, message: "خدمة المساعد الغذائي جاهزة" }, 200, origin);
    }

    if (request.method !== "POST" || url.pathname !== "/ask") {
      return reply({ ok: false, error: "المسار غير صحيح. استخدم POST /ask" }, 404, origin);
    }

    if (origin !== ALLOWED_ORIGIN) {
      return reply({ ok: false, error: "مصدر الطلب غير مسموح" }, 403, origin);
    }

    if (!env.AI || typeof env.AI.run !== "function") {
      return reply({ ok: false, error: "ربط Workers AI باسم AI غير مضبوط" }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ ok: false, error: "تعذر قراءة بيانات الطلب" }, 400, origin);
    }

    const mealName = String(body.mealName || "").trim();
    const message = String(body.message || "").trim();
    if (!mealName && !message) {
      return reply({ ok: false, error: "اكتب اسم الأكلة أو سؤالك أولًا" }, 400, origin);
    }

    const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : "";
    if (body.image && !image) {
      return reply({ ok: false, error: "صيغة الصورة غير مدعومة" }, 400, origin);
    }
    if (image.length > MAX_IMAGE_CHARS) {
      return reply({ ok: false, error: "الصورة كبيرة جدًا" }, 413, origin);
    }

    const targetMin = Number(body.targetMin ?? 1800);
    const targetMax = Number(body.targetMax ?? 1900);
    const targetProtein = Number(body.targetProtein ?? 140);

    const eatenToday = Array.isArray(body.eatenToday)
      ? body.eatenToday.slice(0, 30).map(meal => ({
          name: String(meal.name || "").slice(0, 120),
          calories: nonNegative(meal.calories),
          protein: nonNegative(meal.protein),
          carbs: nonNegative(meal.carbs),
          fat: nonNegative(meal.fat)
        }))
      : [];

    const totals = eatenToday.reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const prompt = `
أنت مساعد غذائي عربي عملي تتحدث باللهجة الأردنية المبسطة.
لا تشخّص الأمراض، ولا تدّعي دقة غذائية غير واقعية.

هدف السعرات اليومي: ${targetMin}-${targetMax}.
هدف البروتين اليومي: ${targetProtein} غرام.

الوجبات المسجلة اليوم:
${JSON.stringify(eatenToday)}

إجمالي الوجبات المسجلة:
${JSON.stringify(totals)}

السعرات المتبقية حتى الحد الأعلى:
${Math.max(0, targetMax - totals.calories)}

البروتين المتبقي:
${Math.max(0, targetProtein - totals.protein)}

اسم الأكلة: ${mealName || "غير محدد"}
سؤال المستخدم: ${message || "اقترح الكمية المناسبة."}

التعليمات:
- اقترح كمية واقعية بالغرام أو عدد القطع.
- وضّح إن كان الوزن قبل الطبخ أو بعده.
- قدّر السعرات والبروتين والكربوهيدرات والدهون.
- راعِ الوجبات المسجلة ولا تفترض أن المتبقي كله يجب تناوله.
- اذكر الافتراضات عندما تكون التفاصيل ناقصة.
- لا تقترح التجويع أو تخطي الوجبات كعقوبة.
- لا تحفظ الوجبة ولا تدّعِ أنها حُفظت.
- احترم النفي والاستثناءات في سؤال المستخدم (مثل: ما بدي، بدون، مش، ما أريد)، ولا تقترح أي شيء استثناه.
- إذا طلب المستخدم شيئًا محددًا، التزم بالمكونات التي ذكرها فقط ولا تضف مكونات لم يذكرها.
- أجب بالعربية وباختصار.
- أعد JSON فقط دون Markdown، باستخدام المفاتيح التالية:
{
  "reply": "شرح الاقتراح",
  "portion": "الكمية المقترحة",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "assumptions": "الافتراضات"
}
اجعل القيم الغذائية أرقامًا غير سالبة.
`;

    try {
      const result = image
        ? await describeWithVision(env, prompt + VISION_ITEMS_INSTRUCTIONS, image)
        : await env.AI.run(MODEL, {
            messages: [
              { role: "system", content: "أنت مساعد غذائي. أعد JSON صالحًا فقط." },
              { role: "user", content: prompt }
            ],
            max_tokens: 1200,
            temperature: 0.3,
            reasoning_effort: "low",
            chat_template_kwargs: { enable_thinking: false },
            response_format: { type: "json_object" }
          });

      const raw =
        result?.response ??
        result?.choices?.[0]?.message?.content ??
        result?.result?.response ??
        result?.output_text ??
        null;

      if (!raw) {
        console.error("Workers AI returned no response", { model: image ? VISION_MODEL : MODEL });
        return reply({ ok: false, error: "النموذج لم يُرجع إجابة. حاول مرة أخرى." }, 502, origin);
      }

      let answer;
      try {
        answer = extractJSON(raw);
      } catch {
        console.error("Workers AI returned invalid JSON", { model: image ? VISION_MODEL : MODEL });
        return reply({ ok: false, error: "وصل رد غير منسق من النموذج. حاول مرة أخرى." }, 502, origin);
      }

      // Per-item answer from the vision path. Totals are summed from the items.
      const items = Array.isArray(answer.items) ? normalizeItems(answer.items) : [];
      const itemTotals = items.reduce((sum, item) => ({
        calories: sum.calories + item.calories,
        protein: sum.protein + item.protein,
        carbs: sum.carbs + item.carbs,
        fat: sum.fat + item.fat
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      const useItems = items.length > 0;

      return reply({
        ok: true,
        answer: {
          reply: String(answer.reply || ""),
          portion: useItems ? items.map(item => item.name).join("، ") : String(answer.portion || ""),
          calories: useItems ? Math.round(itemTotals.calories) : nonNegative(answer.calories),
          protein: useItems ? Math.round(itemTotals.protein * 10) / 10 : nonNegative(answer.protein),
          carbs: useItems ? Math.round(itemTotals.carbs * 10) / 10 : nonNegative(answer.carbs),
          fat: useItems ? Math.round(itemTotals.fat * 10) / 10 : nonNegative(answer.fat),
          assumptions: String(answer.assumptions || "")
        },
        items,
        totals,
        remainingCalories: Math.max(0, targetMax - totals.calories),
        remainingProtein: Math.max(0, targetProtein - totals.protein)
      }, 200, origin);
    } catch (error) {
      console.error("Workers AI request failed:", { model: image ? VISION_MODEL : MODEL, message: String(error?.message || error).slice(0, 500) });
      return reply({ ok: false, error: "تعذر تشغيل نموذج الذكاء الاصطناعي. راجع سجلات Cloudflare." }, 502, origin);
    }
  }
};

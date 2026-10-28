(() => {
  "use strict";

  const URL = "https://chcapjgjvvwpljgdffpg.supabase.co";
  const KEY = "sb_publishable_9dzltRprFtyXPyg0Iul3aQ_4SU1VTG9";
  const DB_NAME = "my-food-assistant-db";
  const TABLE = "meals";

  let client;
  let localDB;
  let busy = false;

  const el = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function status(message) {
    const node = document.getElementById("food-sync-status");
    if (node) node.textContent = message;
  }

  function button(label, handler) {
    const b = el("button", label);
    b.type = "button";
    b.style.cssText =
      "padding:11px 13px;margin:5px;border:0;border-radius:10px;" +
      "background:#315c45;color:white;font:inherit;cursor:pointer";
    b.addEventListener("click", handler);
    return b;
  }

  function input(type, placeholder) {
    const node = el("input");
    node.type = type;
    node.placeholder = placeholder;
    node.autocomplete = type === "password"
      ? "current-password"
      : "email";
    node.style.cssText =
      "box-sizing:border-box;width:100%;padding:12px;margin:6px 0;" +
      "border:1px solid #dfe5dc;border-radius:10px;font:inherit";
    return node;
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function openLocalDB() {
    if (localDB) return localDB;

    localDB = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return localDB;
  }

  async function getLocalMeals() {
    const d = await openLocalDB();
    return request(
      d.transaction("meals", "readonly")
        .objectStore("meals")
        .getAll()
    );
  }

  async function putLocalMeal(meal) {
    const d = await openLocalDB();
    return request(
      d.transaction("meals", "readwrite")
        .objectStore("meals")
        .put(meal)
    );
  }

  function makeClientId() {
    if (crypto.randomUUID) return crypto.randomUUID();

    return "meal-" + Date.now() + "-" +
      Math.random().toString(36).slice(2);
  }

  function toRemote(meal, userId) {
    return {
      user_id: userId,
      client_id: meal.clientId,
      meal_name: String(meal.name || "وجبة"),
      meal_type: String(meal.type || ""),
      meal_date: new Date(meal.date).toISOString(),
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0,
      ingredients: String(meal.ingredients || ""),
      notes: String(meal.notes || ""),
      updated_at: meal.updatedAt || new Date().toISOString()
    };
  }

  function toLocal(remote, existing) {
    return {
      ...(existing && existing.id !== undefined
        ? { id: existing.id }
        : {}),
      clientId: remote.client_id,
      name: remote.meal_name || "وجبة",
      type: remote.meal_type || "وجبة خفيفة",
      date: remote.meal_date,
      calories: Number(remote.calories) || 0,
      protein: Number(remote.protein) || 0,
      carbs: Number(remote.carbs) || 0,
      fat: Number(remote.fat) || 0,
      ingredients: remote.ingredients || "",
      notes: remote.notes || "",
      updatedAt: remote.updated_at || remote.created_at ||
        new Date().toISOString()
    };
  }

  async function ensureClientIds(meals) {
    let changed = 0;

    for (const meal of meals) {
      if (!meal.clientId) {
        meal.clientId = makeClientId();
        await putLocalMeal(meal);
        changed++;
      }
    }

    return changed;
  }

  async function sync() {
    if (busy) return;
    busy = true;

    try {
      const { data: { user }, error: userError } =
        await client.auth.getUser();

      if (userError || !user) {
        status("سجّل الدخول أولًا.");
        return;
      }

      status("جارٍ تجهيز الوجبات المحلية...");
      const local = await getLocalMeals();
      await ensureClientIds(local);

      const currentLocal = await getLocalMeals();
      const remoteRows = currentLocal.map(m => toRemote(m, user.id));

      if (remoteRows.length) {
        status("جارٍ رفع " + remoteRows.length + " وجبة...");

        const { error } = await client
          .from(TABLE)
          .upsert(remoteRows, {
            onConflict: "user_id,client_id"
          });

        if (error) {
          throw new Error("تعذّر رفع الوجبات: " + error.message);
        }
      }

      status("جارٍ تنزيل الوجبات من السحابة...");

      const { data: remote, error: downloadError } = await client
        .from(TABLE)
        .select("*")
        .eq("user_id", user.id);

      if (downloadError) {
        throw new Error("تعذّر تنزيل الوجبات: " + downloadError.message);
      }

      const latestLocal = await getLocalMeals();
      const byClientId = new Map(
        latestLocal
          .filter(m => m.clientId)
          .map(m => [m.clientId, m])
      );

      let added = 0;
      let updated = 0;

      for (const row of remote || []) {
        if (!row.client_id) continue;

        const existing = byClientId.get(row.client_id);
        const remoteTime = Date.parse(row.updated_at || row.created_at || 0);
        const localTime = Date.parse(existing?.updatedAt || 0);

        if (existing && localTime >= remoteTime) continue;

        const meal = toLocal(row, existing);
        await putLocalMeal(meal);

        if (existing) updated++;
        else added++;
      }

      const refresh = document.querySelector("#food-sync-status");
      if (refresh) {
        status(
          "اكتملت المزامنة بنجاح. " +
          "تم تنزيل " + added + " وجبة جديدة" +
          (updated ? " وتحديث " + updated + " وجبة." : ".")
        );
      }

      // تحديث واجهة التطبيق إن كانت دواله متاحة.
      window.dispatchEvent(new CustomEvent("food-sync-complete"));
      alert("اكتملت المزامنة. أعد تحميل التطبيق إذا لم تظهر الوجبات الجديدة.");
    } catch (error) {
      console.error("Food sync error:", error);
      status(String(error.message || error));
      alert(String(error.message || error));
    } finally {
      busy = false;
    }
  }

  async function start() {
    if (!window.supabase) {
      const script = el("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = start;
      script.onerror = () => status("تعذّر تحميل مكتبة Supabase.");
      document.head.appendChild(script);
      return;
    }

    client = window.supabase.createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    window.foodSupabase = client;

    const panel = el("section");
    panel.dir = "rtl";
    panel.style.cssText =
      "max-width:760px;margin:16px auto;padding:16px;" +
      "border:1px solid #e7ebe3;border-radius:16px;" +
      "background:white;color:#202a22;font-family:inherit";

    const title = el("h3", "☁️ حساب ومزامنة مساعدي الغذائي");
    const info = el("p", "تسجيل الدخول يحفظ جلستك على هذا الجهاز.");
    const state = el("p", "جارٍ التحقق من الجلسة...");
    state.id = "food-sync-status";

    const email = input("email", "البريد الإلكتروني");
    const password = input("password", "كلمة المرور");

    const controls = el("div");
    controls.append(
      button("إنشاء حساب", async () => {
        if (!email.value.trim() || !password.value) {
          status("أدخل البريد الإلكتروني وكلمة المرور.");
          return;
        }

        status("جارٍ إنشاء الحساب...");

        const { data, error } = await client.auth.signUp({
          email: email.value.trim(),
          password: password.value
        });

        if (error) {
          status("تعذّر إنشاء الحساب: " + error.message);
          return;
        }

        status(
          data.session
            ? "تم إنشاء الحساب وتسجيل الدخول."
            : "تحقّق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول."
        );
      }),
      button("تسجيل الدخول", async () => {
        if (!email.value.trim() || !password.value) {
          status("أدخل البريد الإلكتروني وكلمة المرور.");
          return;
        }

        status("جارٍ تسجيل الدخول...");

        const { error } = await client.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value
        });

        if (error) {
          status("تعذّر تسجيل الدخول: " + error.message);
          return;
        }

        status("تم تسجيل الدخول. يمكنك الآن مزامنة وجباتك.");
      }),
      button("مزامنة الوجبات الآن", sync),
      button("تسجيل الخروج", async () => {
        const { error } = await client.auth.signOut();
        status(error ? error.message : "تم تسجيل الخروج.");
      })
    );

    panel.append(title, info, state, email, password, controls);

    const app = document.querySelector("main.app");
    if (app) app.appendChild(panel);
    else document.body.appendChild(panel);

    const { data: { session } } = await client.auth.getSession();

    status(
      session
        ? "مسجّل الدخول: " + session.user.email
        : "سجّل الدخول أو أنشئ حسابًا للبدء."
    );

    client.auth.onAuthStateChange((_event, sessionNow) => {
      status(
        sessionNow
          ? "مسجّل الدخول: " + sessionNow.user.email
          : "سجّل الدخول أو أنشئ حسابًا للبدء."
      );
    });
  }

  start();
})();
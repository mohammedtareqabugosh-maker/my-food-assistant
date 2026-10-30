(() => {
  "use strict";

  // Reuse the single Supabase client created by the shared-schedule panel.
  // Do not create a second client or duplicate the login UI.
  const DB_NAME = "my-food-assistant-db";
  const TABLE = "meals";
  let client = null;
  let busy = false;
  let declinedUserId = null;

  const status = message => {
    const node = document.getElementById("food-sync-status") ||
      document.getElementById("ss-status");
    if (node) node.textContent = message;
  };
  const req = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function openDB() {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains("meals")) {
        const store = db.createObjectStore("meals", {keyPath: "id", autoIncrement: true});
        store.createIndex("date", "date");
        store.createIndex("name", "name");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", {keyPath: "key"});
    };
    return req(opening);
  }
  async function readSetting(db, key) {
    if (!db.objectStoreNames.contains("settings")) return undefined;
    return (await req(db.transaction("settings", "readonly").objectStore("settings").get(key)))?.value;
  }
  async function writeSetting(db, key, value) {
    return req(db.transaction("settings", "readwrite").objectStore("settings").put({key, value}));
  }
  async function allLocal(db) {
    return req(db.transaction("meals", "readonly").objectStore("meals").getAll());
  }
  async function putLocal(db, meal) {
    return req(db.transaction("meals", "readwrite").objectStore("meals").put(meal));
  }
  async function deleteLocal(db, id) {
    return req(db.transaction("meals", "readwrite").objectStore("meals").delete(id));
  }
  function newClientId() {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }
  function toRemote(meal, userId) {
    const mealDate = new Date(meal.date);
    if (!Number.isFinite(mealDate.getTime())) {
      throw new Error("توجد وجبة بتاريخ غير صالح. افتح سجل الوجبات وصحّح تاريخها قبل المزامنة.");
    }
    const changedAt = new Date(meal.updatedAt || Date.now());
    const updatedAt = Number.isFinite(changedAt.getTime()) ? changedAt.toISOString() : new Date().toISOString();
    return {
      user_id: userId, client_id: String(meal.clientId),
      meal_name: String(meal.name || "وجبة"), meal_type: String(meal.type || ""),
      meal_date: mealDate.toISOString(),
      calories: Number(meal.calories) || 0, protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0, fat: Number(meal.fat) || 0,
      ingredients: String(meal.ingredients || ""), notes: String(meal.notes || ""),
      updated_at: updatedAt
    };
  }
  function toLocal(row, existing) {
    return {
      ...(existing && existing.id !== undefined ? {id: existing.id} : {}),
      clientId: String(row.client_id), name: row.meal_name || "وجبة",
      type: row.meal_type || "وجبة خفيفة", date: row.meal_date,
      calories: Number(row.calories) || 0, protein: Number(row.protein) || 0,
      carbs: Number(row.carbs) || 0, fat: Number(row.fat) || 0,
      ingredients: row.ingredients || "", notes: row.notes || "",
      updatedAt: row.updated_at || row.created_at || new Date().toISOString()
    };
  }
  async function sync() {
    if (busy || !client) return;
    busy = true;
    let db;
    let refreshSharedSchedule = false;
    try {
      const {data: {user}, error: authError} = await client.auth.getUser();
      if (authError) throw authError;
      if (!user) return;
      if (declinedUserId === user.id) return;
      db = await openDB();
      if (!db.objectStoreNames.contains("meals")) throw new Error("لم يتم العثور على سجل الوجبات المحلي.");
      const previousUserId = await readSetting(db, "syncUserId");
      const local = await allLocal(db);
      if (local.length && (!previousUserId || previousUserId !== user.id)) {
        const approved = window.confirm("قبل المزامنة: سيتم رفع جميع الوجبات المحفوظة محليًا على هذا الجهاز إلى حساب صحن الحالي. هل تريد المتابعة؟");
        if (!approved) { declinedUserId = user.id; status("أوقفت المزامنة حتى لا تُرفع بيانات الجهاز دون موافقتك."); return; }
      }
      for (const meal of local) {
        if (!meal.clientId) {
          meal.clientId = newClientId();
          meal.updatedAt = meal.updatedAt || new Date().toISOString();
          await putLocal(db, meal);
        }
      }

      const tombstones = await readSetting(db, "deletedMeals") || [];
      if (tombstones.length) {
        status("جارٍ تطبيق الوجبات المحذوفة على السحابة…");
        const {error: mealsDeleteError} = await client.from(TABLE).delete()
          .eq("user_id", user.id).in("client_id", tombstones);
        if (mealsDeleteError) throw new Error("تعذّر حذف الوجبات من سجل الغذاء: " + mealsDeleteError.message);
        const {error: scheduleDeleteError} = await client.from("shared_schedule").delete()
          .eq("user_id", user.id).in("id", tombstones);
        if (scheduleDeleteError) throw new Error("تعذّر حذف الوجبات من الجدول المشترك: " + scheduleDeleteError.message);
        await writeSetting(db, "deletedMeals", []);
        const synced = await readSetting(db, "syncedMeals") || [];
        await writeSetting(db, "syncedMeals", synced.filter(id => !tombstones.includes(id)));
      }

      status("جارٍ مزامنة سجل الوجبات…");
      const {data: remoteRows, error: downloadError} = await client.from(TABLE)
        .select("*").eq("user_id", user.id);
      if (downloadError) throw new Error("تعذّر تنزيل سجل الوجبات: " + downloadError.message);
      const remote = remoteRows || [];
      const remoteIds = new Set(remote.map(row => row.client_id).filter(Boolean));
      const syncedBefore = new Set(await readSetting(db, "syncedMeals") || []);
      const localBefore = await allLocal(db);
      const missing = localBefore.filter(meal =>
        meal.clientId && syncedBefore.has(meal.clientId) && !remoteIds.has(meal.clientId)
      );
      if (missing.length) {
        const ids = missing.map(meal => meal.clientId);
        const {error} = await client.from("shared_schedule").delete()
          .eq("user_id", user.id).in("id", ids);
        if (error) throw new Error("تعذّر مزامنة حذف الوجبات: " + error.message);
        for (const meal of missing) await deleteLocal(db, meal.id);
      }

      const latest = await allLocal(db);
      const byId = new Map(latest.filter(meal => meal.clientId).map(meal => [meal.clientId, meal]));
      let added = 0, updated = 0;
      for (const row of remote) {
        if (!row.client_id) continue;
        const existing = byId.get(row.client_id);
        const remoteTime = Date.parse(row.updated_at || row.created_at || 0);
        const localTime = Date.parse(existing?.updatedAt || 0);
        if (existing && localTime >= remoteTime) continue;
        await putLocal(db, toLocal(row, existing));
        if (existing) updated++; else added++;
      }

      const finalLocal = await allLocal(db);
      if (finalLocal.length) {
        const upload = finalLocal.map(meal => toRemote(meal, user.id));
        const {error} = await client.from(TABLE).upsert(upload, {onConflict: "user_id,client_id"});
        if (error) throw new Error("تعذّر رفع سجل الوجبات: " + error.message);

        const scheduleRows = finalLocal.map(meal => ({
          id: String(meal.clientId), user_id: user.id, kind: "meal",
          title: String(meal.name || "وجبة"),
          details: String(meal.ingredients || meal.notes || ""),
          starts_at: upload.find(row => row.client_id === String(meal.clientId))?.meal_date,
          meal_type: String(meal.type || ""), calories: Number(meal.calories) || 0,
          protein: Number(meal.protein) || 0, carbs: Number(meal.carbs) || 0,
          fat: Number(meal.fat) || 0, ingredients: String(meal.ingredients || ""),
          source_app: "my-food-assistant", updated_at: meal.updatedAt || new Date().toISOString()
        }));
        const {error: scheduleError} = await client.from("shared_schedule")
          .upsert(scheduleRows, {onConflict: "id"});
        if (scheduleError) throw new Error("تمت مزامنة سجل الغذاء لكن تعذّر تحديث الجدول المشترك: " + scheduleError.message);
      }
      await writeSetting(db, "syncedMeals", finalLocal.map(meal => meal.clientId).filter(Boolean));
      await writeSetting(db, "syncUserId", user.id);
      refreshSharedSchedule = previousUserId !== user.id;
      status("اكتملت المزامنة: " + added + " وجبات جديدة" + (updated ? "، وتحديث " + updated : "") + ".");
      window.dispatchEvent(new Event("food-sync-complete"));
    } catch (error) {
      console.error("Food sync error:", error);
      status(String(error?.message || error));
    } finally {
      if (db) db.close();
      busy = false;
      if (refreshSharedSchedule) {
        // Refresh only after this sync releases the lock to avoid swallowing the follow-up sync event.
        window.dispatchEvent(new Event("shared-schedule-refresh"));
      }
    }
  }

  function attach() {
    if (client) return;
    client = window.sharedScheduleClient || null;
    if (!client) return;
    sync();
    client.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) setTimeout(sync, 0);
    });
    window.addEventListener("food-meal-changed", () => setTimeout(sync, 0));
    window.addEventListener("shared-schedule-updated", () => setTimeout(sync, 0));
  }
  window.addEventListener("shared-schedule-client-ready", attach);
  if (window.sharedScheduleClient) attach();
})();
(() => {
  const SUPABASE_URL = "https://chcapjgjvvwpljgdffpg.supabase.co";
  const SUPABASE_KEY = "sb_publishable_9dzltRprFtyXPyg0Iul3aQ_4SU1VTG9";

  // إنشاء واجهة الربط مع Supabase
  const start = async () => {
    if (!window.supabase) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = start;
      document.head.appendChild(script);
      return;
    }

    const db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    window.foodSupabase = db;

    const panel = document.createElement("section");
    panel.dir = "rtl";
    panel.style.cssText = `
      margin:16px 0;padding:16px;border-radius:16px;
      background:#fff;border:1px solid #e5e7eb;
      color:#222;font-family:inherit
    `;

    panel.innerHTML = `
      <h3 style="margin:0 0 12px">☁️ مزامنة مساعدي الغذائي</h3>
      <p id="food-sync-status">جاهز للاتصال</p>
      <input id="food-sync-email" type="email" placeholder="البريد الإلكتروني"
        autocomplete="email"
        style="box-sizing:border-box;width:100%;padding:12px;margin:5px 0">
      <input id="food-sync-password" type="password" placeholder="كلمة المرور"
        autocomplete="current-password"
        style="box-sizing:border-box;width:100%;padding:12px;margin:5px 0">
      <button id="food-sync-signup" style="padding:10px;margin:5px">إنشاء حساب</button>
      <button id="food-sync-login" style="padding:10px;margin:5px">تسجيل الدخول</button>
      <button id="food-sync-logout" style="padding:10px;margin:5px">تسجيل الخروج</button>
    `;

    document.body.appendChild(panel);

    const status = panel.querySelector("#food-sync-status");
    const email = panel.querySelector("#food-sync-email");
    const password = panel.querySelector("#food-sync-password");

    panel.querySelector("#food-sync-signup").onclick = async () => {
      if (!email.value.trim() || !password.value) {
        status.textContent = "أدخل البريد الإلكتروني وكلمة المرور.";
        return;
      }

      status.textContent = "جارٍ إنشاء الحساب...";
      const { error } = await db.auth.signUp({
        email: email.value.trim(),
        password: password.value
      });

      status.textContent = error
        ? "تعذّر إنشاء الحساب: " + error.message
        : "تم إرسال طلب إنشاء الحساب. افحص بريدك الإلكتروني إذا طُلب تأكيده.";
    };

    panel.querySelector("#food-sync-login").onclick = async () => {
      if (!email.value.trim() || !password.value) {
        status.textContent = "أدخل البريد الإلكتروني وكلمة المرور.";
        return;
      }

      status.textContent = "جارٍ تسجيل الدخول...";
      const { error } = await db.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      });

      if (error) {
        status.textContent = "تعذّر تسجيل الدخول: " + error.message;
        return;
      }

      const { data } = await db.auth.getUser();
      status.textContent = data.user
        ? "تم تسجيل الدخول بنجاح: " + data.user.email
        : "تم تسجيل الدخول.";
    };

    panel.querySelector("#food-sync-logout").onclick = async () => {
      const { error } = await db.auth.signOut();
      status.textContent = error
        ? "تعذّر تسجيل الخروج: " + error.message
        : "تم تسجيل الخروج.";
    };

    const { data: { session } } = await db.auth.getSession();
    status.textContent = session
      ? "أنت مسجّل الدخول: " + session.user.email
      : "سجّل الدخول أو أنشئ حسابًا للمتابعة.";
  };

  start();
})();
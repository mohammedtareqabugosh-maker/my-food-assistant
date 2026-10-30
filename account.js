(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = `
    :root{--bg:#f4f8f6;--surface:#ffffff;--surface-2:#eaf2ef;--ink:#20312f;--muted:#647773;--line:#d9e6e1;--accent:#176b67;--accent-strong:#10514e;--accent-soft:#dcefea;--accent-border:#b9dcd4;--on-accent:#fff;--tomato:#d97757;--tomato-soft:#fbe9e2;--gold:#c39a54;--gold-soft:#f5eddd;--danger:#b94f45;--danger-soft:#fae7e4;--shadow:0 18px 46px -34px rgba(20,65,60,.25);--shadow-hover:0 20px 42px -27px rgba(20,65,60,.2)}
    :root[data-theme="dark"]{--bg:#142321;--surface:#1d302d;--surface-2:#263b37;--ink:#eff7f4;--muted:#a9beb8;--line:#344d47;--accent:#66b8ac;--accent-strong:#8dd0c4;--accent-soft:#294943;--accent-border:#3d6c63;--on-accent:#102b27;--tomato:#f09a7a;--tomato-soft:#442f29;--gold:#e3c17c;--gold-soft:#3e3828;--danger:#ff9b8e;--danger-soft:#432b2b;--shadow:0 18px 46px -34px rgba(0,0,0,.6)}
    .sahn-account-trigger{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:9px 13px;font:inherit;font-size:12px;font-weight:800;display:flex;align-items:center;gap:7px;white-space:nowrap;cursor:pointer}
    .sahn-account-trigger .dot{width:7px;height:7px;border-radius:50%;background:var(--tomato)}
    .sahn-account-trigger[data-signed="true"] .dot{background:#299b72}
    .sahn-account-overlay{position:fixed;inset:0;z-index:1000;background:rgba(10,25,23,.48);backdrop-filter:blur(7px);display:none;align-items:center;justify-content:center;padding:18px}
    .sahn-account-overlay.open{display:flex}
    .sahn-account-card{width:min(100%,440px);max-height:min(90dvh,760px);overflow:auto;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:28px;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.22);direction:rtl}
    .sahn-account-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}
    .sahn-account-head h2{margin:0;font-size:22px;letter-spacing:-.03em}.sahn-account-head p{margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.7}
    .sahn-account-close{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);width:36px;height:36px;border-radius:12px;font-size:20px;cursor:pointer}
    .sahn-account-tabs{display:flex;gap:6px;padding:4px;border-radius:14px;background:var(--surface-2);margin:14px 0}
    .sahn-account-tabs button{flex:1;border:0;border-radius:10px;padding:10px 6px;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:800;cursor:pointer}
    .sahn-account-tabs button.active{background:var(--surface);color:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .sahn-account-field{display:block;margin:12px 0;font-size:13px;font-weight:800}.sahn-account-field input{display:block;width:100%;margin-top:7px;padding:13px 14px;border:1px solid var(--line);border-radius:13px;background:var(--bg);color:var(--ink);font:inherit;outline:none}.sahn-account-field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
    .sahn-account-primary,.sahn-account-secondary,.sahn-account-danger{width:100%;border:0;border-radius:14px;padding:13px 14px;font:inherit;font-weight:900;cursor:pointer;margin-top:9px}
    .sahn-account-primary{background:var(--accent);color:var(--on-accent)}.sahn-account-secondary{background:var(--accent-soft);color:var(--accent-strong);border:1px solid var(--accent-border)}.sahn-account-danger{background:var(--danger-soft);color:var(--danger);border:1px solid var(--danger)}
    .sahn-account-primary:disabled,.sahn-account-secondary:disabled{opacity:.55;cursor:wait}
    .sahn-account-message{font-size:13px;line-height:1.7;margin:12px 0;color:var(--accent-strong);overflow-wrap:anywhere}.sahn-account-message.error{color:var(--danger)}
    .sahn-account-note{font-size:11px;color:var(--muted);line-height:1.8;margin:16px 0 0}
    .sahn-account-profile{background:var(--surface-2);border:1px solid var(--line);border-radius:17px;padding:15px;margin:12px 0}.sahn-account-profile strong{display:block;overflow-wrap:anywhere}.sahn-account-profile span{display:block;font-size:12px;color:var(--muted);margin-top:5px}
    .sahn-account-setting{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:12px 0;border-top:1px solid var(--line);font-size:13px;font-weight:800}
    .sahn-account-setting select{max-width:150px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:10px;padding:8px;font:inherit}
    @media(max-width:520px){.sahn-account-card{padding:19px;border-radius:23px}.sahn-account-trigger{padding:8px 10px}.sahn-account-trigger .trigger-label{display:none}}
  `;
  document.head.appendChild(style);

  const svg = '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'sahn-account-trigger';
  trigger.innerHTML = '<span class="dot"></span>' + svg + '<span class="trigger-label">الحساب</span>';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const header = document.querySelector('header');
  const date = document.getElementById('datePill');
  if (header) header.insertBefore(trigger, date || null);

  const overlay = document.createElement('div');
  overlay.className = 'sahn-account-overlay';
  overlay.innerHTML = `
    <section class="sahn-account-card" role="dialog" aria-modal="true" aria-labelledby="sahnAccountTitle">
      <div class="sahn-account-head"><div><h2 id="sahnAccountTitle">حسابك في صحن</h2><p id="sahnAccountSubtitle">سجّل الدخول حتى تقدر توصل لسجل وجباتك من أجهزتك.</p></div><button class="sahn-account-close" type="button" aria-label="إغلاق">×</button></div>
      <div id="sahnAccountBody"><p class="sahn-account-message">جارٍ تجهيز تسجيل الدخول…</p></div>
      <p class="sahn-account-note">تسجيل الدخول يستخدم حساب Supabase نفسه الذي يربط صحن بجدولي الأسبوعي. لا تشارك كلمة مرورك مع أي شخص. سجل الوجبات يُزامَن عبر خدمة صحن عند تسجيل الدخول.</p>
    </section>`;
  document.body.appendChild(overlay);
  const body = overlay.querySelector('#sahnAccountBody');
  const subtitle = overlay.querySelector('#sahnAccountSubtitle');
  const closeBtn = overlay.querySelector('.sahn-account-close');
  let client = window.sharedScheduleClient || null;
  let mode = 'login', busy = false, message = '', error = '', currentUser = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setMessage = (text, isError = false) => { message = text; error = isError; render(); };
  const setClient = () => { client = window.sharedScheduleClient || client; if (client) refreshUser(); else render(); };
  function render() {
    trigger.dataset.signed = currentUser ? 'true' : 'false';
    trigger.querySelector('.trigger-label').textContent = currentUser ? 'حسابي' : 'تسجيل الدخول';
    if (!client) {
      body.innerHTML = '<p class="sahn-account-message error">تعذّر الاتصال بخدمة الحساب. تحقق من اتصال الإنترنت ثم أعد تحميل التطبيق.</p><button class="sahn-account-secondary" type="button" data-account-retry>إعادة المحاولة</button>';
      body.querySelector('[data-account-retry]').onclick = setClient;
      return;
    }
    if (currentUser) {
      subtitle.textContent = 'حسابك متصل؛ بيانات الوجبات تُزامَن عند توفر الاتصال.';
      body.innerHTML = `
        <div class="sahn-account-profile"><strong>${esc(currentUser.email || 'حساب صحن')}</strong><span>تم تسجيل الدخول بنجاح</span></div>
        <p class="sahn-account-message ${error ? 'error' : ''}" role="status">${esc(message || 'تقدر تتابع استخدام التطبيق، وستتم مزامنة سجل الوجبات تلقائيًا عند توفر الاتصال.')}</p>
        <div class="sahn-account-setting"><label for="sahnThemeChoice">مظهر التطبيق</label><select id="sahnThemeChoice"><option value="light">فاتح</option><option value="dark">داكن</option><option value="system">حسب الجهاز</option></select></div>
        <button class="sahn-account-secondary" type="button" data-account-refresh ${busy?'disabled':''}>مزامنة سجل الوجبات الآن</button>
        <button class="sahn-account-danger" type="button" data-account-logout ${busy?'disabled':''}>تسجيل الخروج</button>`;
      const themeChoice = body.querySelector('#sahnThemeChoice');
      themeChoice.value = localStorage.getItem('sahn-theme-choice') || 'system';
      themeChoice.onchange = () => applyTheme(themeChoice.value);
      body.querySelector('[data-account-refresh]').onclick = async () => {
        busy = true; message = 'جارٍ بدء مزامنة سجل الوجبات…'; render();
        window.dispatchEvent(new Event('food-meal-changed'));
        window.dispatchEvent(new Event('shared-schedule-refresh'));
        setTimeout(() => { busy = false; setMessage('أُرسِل طلب المزامنة. راجع حالة المزامنة في قسم الجدول الأسبوعي إذا ظهرت مشكلة.'); }, 1200);
      };
      body.querySelector('[data-account-logout]').onclick = async () => {
        busy = true; render();
        const {error: signOutError} = await client.auth.signOut();
        busy = false;
        if (signOutError) setMessage('تعذّر تسجيل الخروج: ' + signOutError.message, true);
        else { currentUser = null; setMessage('تم تسجيل الخروج. بقيت البيانات المحلية على هذا الجهاز.'); }
      };
      return;
    }
    subtitle.textContent = mode === 'reset' ? 'سنرسل رابط استعادة كلمة المرور إلى بريدك.' : 'سجّل الدخول للوصول إلى سجل الوجبات من أجهزتك.';
    body.innerHTML = `
      <div class="sahn-account-tabs"><button type="button" data-mode="login" class="${mode==='login'?'active':''}">تسجيل الدخول</button><button type="button" data-mode="signup" class="${mode==='signup'?'active':''}">إنشاء حساب</button></div>
      ${mode==='reset'?'':'<label class="sahn-account-field">البريد الإلكتروني<input id="sahnAuthEmail" type="email" autocomplete="email" required placeholder="name@example.com"></label>'}
      ${mode==='reset'?'':'<label class="sahn-account-field">كلمة المرور<input id="sahnAuthPassword" type="password" autocomplete="'+(mode==='signup'?'new-password':'current-password')+'" minlength="6" placeholder="6 أحرف على الأقل" required></label>'}
      <p class="sahn-account-message ${error?'error':''}" role="status">${esc(message)}</p>
      <button class="sahn-account-primary" type="button" data-account-submit ${busy?'disabled':''}>${busy?'لحظة واحدة…':mode==='login'?'تسجيل الدخول':mode==='signup'?'إنشاء حساب':'إرسال رابط الاستعادة'}</button>
      ${mode!=='reset'?'<button class="sahn-account-secondary" type="button" data-account-google '+(busy?'disabled':'')+'>المتابعة باستخدام Google</button>':''}
      ${mode==='login'?'<button class="sahn-account-secondary" type="button" data-account-reset>نسيت كلمة المرور؟</button>': '<button class="sahn-account-secondary" type="button" data-mode="login">العودة لتسجيل الدخول</button>'}`;
    body.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; message=''; error=false; render(); }));
    const submit = body.querySelector('[data-account-submit]');
    submit.onclick = async () => {
      const email = body.querySelector('#sahnAuthEmail')?.value.trim();
      const password = body.querySelector('#sahnAuthPassword')?.value;
      if (!email) { setMessage('اكتب بريدك الإلكتروني أولًا.', true); return; }
      if (mode !== 'reset' && (!password || password.length < 6)) { setMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', true); return; }
      busy = true; message=''; error=false; render();
      try {
        let result;
        if (mode === 'login') result = await client.auth.signInWithPassword({email,password});
        else if (mode === 'signup') result = await client.auth.signUp({email,password,options:{emailRedirectTo:location.href.split('#')[0]}});
        else result = await client.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});
        if (result.error) throw result.error;
        busy = false;
        if (mode === 'signup') setMessage(result.data?.session ? 'تم إنشاء الحساب وتسجيل الدخول.' : 'تم إرسال طلب إنشاء الحساب. افحص بريدك لتأكيده ثم ارجع لتسجيل الدخول.');
        else if (mode === 'reset') setMessage('إذا كان البريد مسجّلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.');
        else { currentUser = result.data?.user || null; setMessage('تم تسجيل الدخول بنجاح.'); }
      } catch (e) { busy=false; setMessage(e?.message || 'تعذّر إكمال العملية. حاول مرة أخرى.', true); }
    };
    body.querySelector('[data-account-google]')?.addEventListener('click', async () => {
      busy=true; render();
      const {error: oauthError} = await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});
      if (oauthError) { busy=false; setMessage(oauthError.message, true); }
    });
    body.querySelector('[data-account-reset]')?.addEventListener('click', () => { mode='reset';message='';error=false;render(); });
  }
  async function refreshUser() {
    if (!client) return render();
    const {data,error: sessionError} = await client.auth.getSession();
    currentUser = sessionError ? null : data.session?.user || null;
    render();
  }
  function applyTheme(choice) {
    localStorage.setItem('sahn-theme-choice', choice);
    const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }
  applyTheme(localStorage.getItem('sahn-theme-choice') || 'system');
  trigger.addEventListener('click', () => { overlay.classList.add('open'); trigger.setAttribute('aria-expanded','true'); refreshUser(); });
  closeBtn.addEventListener('click', () => { overlay.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); });
  overlay.addEventListener('click', event => { if (event.target === overlay) closeBtn.click(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay.classList.contains('open')) closeBtn.click(); });
  window.addEventListener('shared-schedule-client-ready', setClient);
  window.addEventListener('food-sync-complete', () => { if (overlay.classList.contains('open') && currentUser) setMessage('اكتملت مزامنة سجل الوجبات.'); });
  if (client) refreshUser(); else render();
})();
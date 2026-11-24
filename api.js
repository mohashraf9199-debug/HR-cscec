/* ═══════════════════════════════════════════════════════
   HR System — api.js (تطبيق الموبايل / PWA) v7.3
   • بديل google.script.run: نفس الواجهة بالظبط، بس بتكلّم الـ API (Apps Script doPost) بـ fetch
   • شاشة الربط (لينك الـ API + مفتاح الربط) — مرة واحدة على كل موبايل
   • Service Worker: يفتح من غير نت + إشعار بالتحديثات
   • التقرير بيفتح في نافذة جوه التطبيق (بدل تاب جديد)
   ═══════════════════════════════════════════════════════ */
(function(){
  var CFG_KEY='hr_api', TIMEOUT=60000;

  // ═══ الإعدادات المحفوظة على الموبايل ═══
  function cfg(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY)||'null'); }catch(e){ return null; } }
  function setCfg(c){ try{ if(c) localStorage.setItem(CFG_KEY, JSON.stringify(c)); else localStorage.removeItem(CFG_KEY); }catch(e){} }
  window.hrApiCfg_ = cfg;

  // ═══ لينك الربط: ...#setup=<base64url {u,t}> ═══
  function parseSetup_(){
    var m=location.hash.match(/[#&]setup=([\w-]+)/);
    if(!m) return false;
    try{
      var b=m[1].replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='=';
      var o=JSON.parse(atob(b));
      if(o && /^https:\/\/script\.google(usercontent)?\.com\//.test(o.u) && /^[a-f0-9]{32,128}$/i.test(o.t)) { setCfg({url:o.u, token:o.t, at:Date.now()}); window.__justLinked=true; }
    }catch(e){}
    try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}   // المفتاح مايفضلش في شريط العنوان
    return !!window.__justLinked;
  }
  parseSetup_();
  window.addEventListener('hashchange', function(){ if(parseSetup_()) location.reload(); });   // لو التطبيق كان مفتوح وفتحت لينك الربط

  // ═══ النداء على الـ API ═══
  function call(fn, args){
    var c=cfg();
    if(!c){ var e0=new Error('📱 التطبيق لسه مش مربوط بالشيت'); e0.code='SETUP'; showSetup_(); return Promise.reject(e0); }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, TIMEOUT) : null;
    return fetch(c.url, {method:'POST', redirect:'follow', cache:'no-store', signal: ctrl ? ctrl.signal : undefined,
                         headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({fn:fn, args:args, token:c.token})})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
      .then(function(t){
        var j; try{ j=JSON.parse(t); }catch(e){
          throw new Error(/<html|<!doctype/i.test(t) ? '⚠️ الـ API مش متاح — اتأكد إنه منشور بـ Who has access = Anyone' : 'رد غير مفهوم من السيرفر'); }
        if(j.error){ var er=new Error(j.error); er.code=j.code; if(j.code==='AUTH') showSetup_(j.error); throw er; }
        return j.result;
      }, function(e){ throw (e && e.name==='AbortError') ? new Error('timeout — الشبكة بطيئة') : e; })
      .then(function(v){ if(timer) clearTimeout(timer); return v; }, function(e){ if(timer) clearTimeout(timer); throw e; });
  }

  // ═══ google.script.run — نفس الشكل اللي الواجهة متعوّدة عليه ═══
  function mk(s,f){ return new Proxy({}, {get:function(_,k){
    if(k==='withSuccessHandler') return function(h){ return mk(h,f); };
    if(k==='withFailureHandler') return function(h){ return mk(s,h); };
    if(k==='withUserObject') return function(){ return mk(s,f); };
    return function(){
      var a=Array.prototype.slice.call(arguments);
      call(k,a).then(function(r){ if(s) s(r); }, function(e){ if(f) f(e); });
    };
  }}); }
  window.google = window.google || {};
  window.google.script = {run: mk(null,null)};

  // ═══ شاشة الربط ═══
  function el(h){ var d=document.createElement('div'); d.innerHTML=h; return d.firstChild; }
  function showSetup_(why){
    if(!document.body){ document.addEventListener('DOMContentLoaded', function(){ showSetup_(why); }); return; }
    if(document.getElementById('setupSheet')) return;
    var c=cfg()||{};
    var sh=el('<div id="setupSheet" class="sheet-back" style="display:flex;z-index:10000"><div class="sheet" role="dialog" aria-modal="true">'+
      '<div class="sheet-hd"><span>📱 ربط التطبيق بالشيت</span></div>'+
      (why ? '<div class="notice err">'+esc(why)+'</div>' : '')+
      '<p class="hint" style="margin:-4px 0 12px;font-size:12.5px">مرة واحدة بس: من الشيت افتح <b>⚙️ HR System ← 📱 ربط تطبيق الموبايل</b> واضغط "📧 ابعت لينك الربط" — وافتح اللينك من الموبايل ده. أو الصق البيانات هنا:</p>'+
      '<div class="f"><label for="su_url">لينك الـ API (Web App)</label><input id="su_url" dir="ltr" placeholder="https://script.google.com/macros/s/.../exec" value="'+esc(c.url||'')+'"></div>'+
      '<div class="f"><label for="su_tok">مفتاح الربط</label><input id="su_tok" dir="ltr" type="password" autocomplete="off" placeholder="••••••••" value=""></div>'+
      '<button type="button" class="btn bp" id="su_go">🔗 ربط</button>'+
      '<p class="hint">البيانات دي بتتحفظ على الموبايل ده بس.</p></div></div>');
    document.body.appendChild(sh);
    document.getElementById('su_go').onclick=function(){
      var u=document.getElementById('su_url').value.trim(), t=document.getElementById('su_tok').value.trim() || (c.token||'');
      if(!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)){ notify('er','❌ لينك الـ API لازم يبدأ بـ https://script.google.com/'); return; }
      if(!/^[a-f0-9]{32,128}$/i.test(t)){ notify('er','❌ مفتاح الربط مش صحيح'); return; }
      var b=this; busy_(b,true,'جاري التجربة...');
      var old=cfg(); setCfg({url:u, token:t, at:Date.now()});
      call('ping',[]).then(function(){ notify('ok','✅ اتربط بنجاح'); setTimeout(function(){ location.reload(); },600); },
        function(e){ busy_(b,false); setCfg(old); notify('er', (e && e.code==='AUTH') ? '🔒 مفتاح الربط غلط' : '❌ مش قادر أوصل للـ API: '+msgOf(e)); });
    };
  }
  window.showSetup_ = showSetup_;

  // ═══ كارت "📱 التطبيق" في الضبط ═══
  var _installEvt=null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); _installEvt=e; var b=document.getElementById('inst_btn'); if(b) b.style.display='flex'; });
  function appCard_(){
    var set=document.getElementById('p-set'); if(!set || document.getElementById('appCard')) return;
    var c=cfg(), host=''; try{ host=c ? (new URL(c.url).pathname.split('/')[3]||'') : ''; }catch(e){}
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    var card=el('<div class="card" id="appCard"><div class="ct">📲 التطبيق</div>'+
      '<div class="fz-state'+(c?' on':'')+'">'+(c ? '🔗 مربوط بالشيت <span class="mono" style="direction:ltr;unicode-bidi:isolate;font-size:11px">…'+esc(host.slice(-10))+'</span>' : '⚠️ مش مربوط')+'</div>'+
      (standalone ? '' : '<button type="button" class="btn bp" id="inst_btn" style="display:'+(_installEvt?'flex':'none')+'">📲 ثبّت التطبيق على الموبايل</button>'+
        (ios ? '<p class="hint">على الآيفون: زرار المشاركة ⬆️ ← "Add to Home Screen"</p>' : ''))+
      '<div class="seg"><button type="button" class="btn bs" id="ping_btn">🔄 اختبار الاتصال</button><button type="button" class="btn br" id="unlink_btn">⛔ فك الربط</button></div>'+
      '<p class="hint">النسخة 7.7 — بيفتح من غير نت، والتسجيل وقت انقطاع النت بيتبعت أول ما يرجع.</p></div>');
    set.insertBefore(card, set.firstChild);
    var ib=document.getElementById('inst_btn');
    if(ib) ib.onclick=function(){ if(!_installEvt) return; _installEvt.prompt(); _installEvt.userChoice.then(function(){ _installEvt=null; ib.style.display='none'; }); };
    document.getElementById('ping_btn').onclick=function(){ var b=this; busy_(b,true); call('ping',[]).then(function(r){ busy_(b,false); notify('ok','✅ متصل — السيرفر: '+r.time); },function(e){ busy_(b,false); notify('er','❌ '+msgOf(e)); }); };
    document.getElementById('unlink_btn').onclick=function(){ if(confirm('تفك ربط الموبايل ده بالشيت؟')){ setCfg(null); location.reload(); } };
  }

  // ═══ التقرير جوه التطبيق (بدل window.open) ═══
  function reportViewer_(html){
    var ov=el('<div class="sheet-back" style="display:flex;z-index:10000;padding:0"><div class="sheet" style="max-width:none;width:100%;height:100%;max-height:none;border-radius:0;padding:0;display:flex;flex-direction:column">'+
      '<div class="sheet-hd" style="margin:0;top:0;padding-top:calc(12px + env(safe-area-inset-top,0px))"><span>📑 التقرير</span><span style="display:flex;gap:6px"><button type="button" class="mini" id="rv_print">🖨️ طباعة</button><button type="button" class="xbtn" id="rv_x" aria-label="إغلاق">✕</button></span></div>'+
      '<iframe id="rv_f" style="flex:1;border:0;width:100%;background:#fff"></iframe></div></div>');
    document.body.appendChild(ov);
    var f=document.getElementById('rv_f'); f.srcdoc=html;
    document.getElementById('rv_x').onclick=function(){ ov.remove(); };
    document.getElementById('rv_print').onclick=function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} };
  }

  document.addEventListener('DOMContentLoaded', function(){
    window.openReport = reportViewer_;
    appCard_();
    if(!cfg()) showSetup_();
    else if(window.__justLinked) setTimeout(function(){ notify('ok','✅ التطبيق اتربط بالشيت — ثبّته من قايمة المتصفح (Install / Add to Home Screen)'); }, 800);
    // اختصار "تسجيل حضور/انصراف" من أيقونة التطبيق
    if(/[?&]action=check/.test(location.search) && typeof renderStats_==='function'){
      // [v7.5] لمسة واحدة: بيسجّل حضور/انصراف على طول أول ما الحالة الحقيقية توصل من السيرفر
      var orig=renderStats_, done=false;
      var fire=function(){ if(done) return; done=true; try{ history.replaceState(null,'',location.pathname+location.hash); }catch(e){} setTimeout(function(){ quickToggle_(); },250); };
      window.renderStats_ = function(s, fromCache){ orig(s, fromCache); if(!fromCache) fire(); };
      // من غير نت: بنعتمد على آخر حالة متخزّنة والتسجيل بيدخل طابور الأوفلاين بوقته الحقيقي
      setTimeout(function(){ if(!done && navigator.onLine===false && typeof _smart!=='undefined' && _smart) fire(); }, 2500);
    }
  });

  // ═══ Service Worker: فتح من غير نت + تحديثات ═══
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').then(function(reg){
        function ask(w){
          var t=document.createElement('div'); t.className='toast ok'; t.style.cursor='pointer'; t.setAttribute('role','status');
          t.textContent='✨ فيه تحديث جديد للتطبيق — اضغط هنا للتحديث';
          t.onclick=function(){ w.postMessage('skip'); t.remove(); };
          document.body.appendChild(t);
        }
        if(reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
        reg.addEventListener('updatefound', function(){
          var w=reg.installing; if(!w) return;
          w.addEventListener('statechange', function(){ if(w.state==='installed' && navigator.serviceWorker.controller) ask(w); });
        });
        setInterval(function(){ reg.update().catch(function(){}); }, 60*60*1000);
      }).catch(function(){});
      var reloading=false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){ if(reloading) return; reloading=true; location.reload(); });
    });
  }
})();

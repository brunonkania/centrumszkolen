/* ==========================================================================
   ProLevel — Global App (no-auth)
   ========================================================================== */

   window.APP = (function () {
    const API_BASE = '/api'; // Nginx/Express proxy do backendu
    const qs = (s, r=document) => r.querySelector(s);
  
    // Toast
    let toastTimer = null;
    function toast(msg, ms = 2600){
      const el = qs('#toast');
      if(!el) return alert(msg);
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(()=> el.classList.remove('show'), ms);
    }
  
    // API helper
    async function api(path, opts={}){
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers }));
      if(!res.ok){
        const text = await res.text().catch(()=> '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      const type = res.headers.get('content-type') || '';
      return type.includes('application/json') ? res.json() : res.text();
    }
  
    // Mobile menu
    function setupMobileMenu(){
      const btn = qs('#hamburger');
      const panel = qs('#mobile');
      if(!btn || !panel) return;
      btn.addEventListener('click', ()=> panel.classList.toggle('open'));
      panel.querySelectorAll('a,button').forEach(el=> el.addEventListener('click', ()=> panel.classList.remove('open')));
    }
  
    return { api, toast, setupMobileMenu };
  })();
  
  document.addEventListener('DOMContentLoaded', ()=>{
    APP.setupMobileMenu();
  });
  
// web/js/ui.js
let toastEl;
export function showToast(text = '') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  setTimeout(() => toastEl.classList.remove('visible'), 2200);
}

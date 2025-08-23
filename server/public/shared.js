const API_URL = 'http://localhost:3000';

function getToken(){ return localStorage.getItem('jwt'); }
function setToken(t){ localStorage.setItem('jwt', t); }
function logout(){ localStorage.removeItem('jwt'); }

function protectRoute(){
  if(!getToken()){
    window.location.href = './logowanie.html';
  }
}

async function authFetch(path, options={}){
  const token = getToken();
  const headers = Object.assign({}, options.headers || {}, token ? { Authorization: 'Bearer ' + token } : {});
  const res = await fetch(API_URL + path, { ...options, headers });
  return res;
}

// ============================================================
//  FARMÁCIA COUTO — script.js
//  Configure suas credenciais do Supabase aqui embaixo ↓
// ============================================================

const SUPABASE_URL = localStorage.getItem('sb_url') || '';
const SUPABASE_KEY = localStorage.getItem('sb_key') || '';

// Credenciais dos atendentes (gerenciadas pelo admin)
// Para adicionar/remover atendentes, edite este objeto:
const ATENDENTES = {
  'admin':     { senha: 'admin123',   nome: 'Administrador' },
  'joao':      { senha: 'couto2025',  nome: 'João Silva' },
  'maria':     { senha: 'farma123',   nome: 'Maria Oliveira' },
};

// ============================================================
//  SUPABASE INIT
// ============================================================
let supabase = null;

function initSupabase(url, key) {
  if (!url || !key) return false;
  try {
    supabase = window.supabase.createClient(url, key);
    return true;
  } catch (e) {
    console.error('Supabase init error:', e);
    return false;
  }
}

// Inicializa com valores salvos
const _url = localStorage.getItem('sb_url');
const _key = localStorage.getItem('sb_key');
if (_url && _key) initSupabase(_url, _key);

// ============================================================
//  SESSÃO
// ============================================================
let currentUser = null;

function checkSession() {
  const saved = sessionStorage.getItem('fc_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showLoggedIn();
  }
}

function showLoggedIn() {
  document.getElementById('sessionBar').classList.add('visible');
  document.getElementById('sessionName').textContent = `👤 ${currentUser.nome}`;
  document.getElementById('tabCadastro').style.display = '';
  document.getElementById('tabLista').style.display = '';
  switchTab('cadastro');
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('fc_user');
  document.getElementById('sessionBar').classList.remove('visible');
  document.getElementById('tabCadastro').style.display = 'none';
  document.getElementById('tabLista').style.display = 'none';
  switchTab('login');
  toast('Sessão encerrada com sucesso.', 'info');
}

// ============================================================
//  LOGIN
// ============================================================
async function doLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;

  if (!user || !pass) {
    toast('Preencha usuário e senha.', 'error'); return;
  }

  const btn = document.getElementById('btnLogin');
  btn.disabled = true; btn.textContent = 'Entrando...';

  await sleep(600); // UX delay

  const atendente = ATENDENTES[user];
  if (atendente && atendente.senha === pass) {
    currentUser = { user, nome: atendente.nome };
    sessionStorage.setItem('fc_user', JSON.stringify(currentUser));
    showLoggedIn();
    toast(`Bem-vindo(a), ${atendente.nome}! ✅`, 'success');
  } else {
    toast('Usuário ou senha incorretos.', 'error');
  }

  btn.disabled = false; btn.textContent = 'Entrar →';
}

// ============================================================
//  CADASTRAR CLIENTE
// ============================================================
async function cadastrarCliente() {
  if (!currentUser) { toast('Faça login primeiro.', 'error'); return; }

  const campos = {
    nome:     document.getElementById('c_nome').value.trim(),
    cpf:      document.getElementById('c_cpf').value.trim(),
    telefone: document.getElementById('c_telefone').value.trim(),
    email:    document.getElementById('c_email').value.trim(),
    endereco: document.getElementById('c_endereco').value.trim(),
    cidade:   document.getElementById('c_cidade').value.trim(),
    estado:   document.getElementById('c_estado').value,
    produto:  document.getElementById('c_produto').value,
    obs:      document.getElementById('c_obs').value.trim(),
  };

  if (!campos.nome || !campos.cpf || !campos.telefone || !campos.endereco || !campos.cidade || !campos.produto) {
    toast('Preencha todos os campos obrigatórios (*).', 'error'); return;
  }

  if (!validarCPF(campos.cpf)) {
    toast('CPF inválido. Verifique o número.', 'error'); return;
  }

  const btn = document.getElementById('btnCadastrar');
  btn.disabled = true; btn.textContent = '⏳ Salvando...';

  const registro = {
    ...campos,
    atendente: currentUser.nome,
    atendente_user: currentUser.user,
    criado_em: new Date().toISOString(),
  };

  let sucesso = false;

  // Tenta salvar no Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('clientes').insert([registro]);
      if (error) throw error;
      sucesso = true;
    } catch (e) {
      console.error('Supabase error:', e);
      toast('⚠️ Supabase não configurado. Salvando localmente.', 'info');
    }
  }

  // Fallback: salvar no localStorage
  if (!sucesso) {
    const lista = JSON.parse(localStorage.getItem('fc_clientes') || '[]');
    lista.push({ ...registro, id: Date.now() });
    localStorage.setItem('fc_clientes', JSON.stringify(lista));
    sucesso = true;
  }

  if (sucesso) {
    toast(`Cliente ${campos.nome} cadastrado com sucesso! ✅`, 'success');
    limparFormCadastro();
  }

  btn.disabled = false; btn.textContent = '💾 Salvar Cadastro';
}

function limparFormCadastro() {
  ['c_nome','c_cpf','c_telefone','c_email','c_endereco','c_cidade','c_obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('c_produto').value = '';
  document.getElementById('c_estado').value = 'SE';
}

// ============================================================
//  LISTAR CLIENTES
// ============================================================
async function carregarClientes() {
  const container = document.getElementById('clientesList');
  container.innerHTML = '<p style="color:var(--gray);text-align:center;padding:2rem">⏳ Carregando...</p>';

  let clientes = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(50);
      if (!error && data) clientes = data;
    } catch (e) {
      console.error(e);
    }
  }

  // Merge com localStorage
  const local = JSON.parse(localStorage.getItem('fc_clientes') || '[]');
  if (local.length > 0 && clientes.length === 0) {
    clientes = local.reverse();
  }

  if (clientes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">🙁</span>
        <p>Nenhum cliente cadastrado ainda.</p>
      </div>`;
    return;
  }

  const html = clientes.map(c => `
    <div class="cliente-row">
      <div>
        <div class="cliente-row-name">${c.nome}</div>
        <div class="cliente-row-meta">📞 ${c.telefone} · ${c.cidade}/${c.estado} · Atendente: ${c.atendente || '—'}</div>
        <div class="cliente-row-meta" style="margin-top:2px">${formatDate(c.criado_em)}</div>
      </div>
      <span class="cliente-row-produto">${c.produto || '—'}</span>
    </div>
  `).join('');

  container.innerHTML = `<div class="clientes-list">${html}</div>
    <p style="text-align:center;margin-top:1rem;color:var(--gray);font-size:0.8rem">
      ${clientes.length} cliente(s) encontrado(s)
    </p>`;
}

// ============================================================
//  CONTATO
// ============================================================
async function enviarContato() {
  const nome  = document.getElementById('msg_nome').value.trim();
  const tel   = document.getElementById('msg_tel').value.trim();
  const texto = document.getElementById('msg_texto').value.trim();

  if (!nome || !texto) { toast('Preencha nome e mensagem.', 'error'); return; }

  const btn = document.getElementById('btnContato');
  btn.disabled = true; btn.textContent = '⏳ Enviando...';

  await sleep(800);

  if (supabase) {
    try {
      await supabase.from('contatos').insert([{ nome, telefone: tel, mensagem: texto, criado_em: new Date().toISOString() }]);
    } catch {}
  }

  toast('Mensagem enviada! Entraremos em contato em breve. 📩', 'success');
  document.getElementById('msg_nome').value = '';
  document.getElementById('msg_tel').value = '';
  document.getElementById('msg_texto').value = '';

  btn.disabled = false; btn.textContent = '📩 Enviar Mensagem';
}

// ============================================================
//  SUPABASE CONFIG MODAL
// ============================================================
function saveConfig() {
  const url = document.getElementById('cfgUrl').value.trim();
  const key = document.getElementById('cfgKey').value.trim();
  if (!url || !key) { toast('Preencha URL e Key.', 'error'); return; }

  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);

  if (initSupabase(url, key)) {
    toast('Supabase conectado com sucesso! ✅', 'success');
    document.getElementById('configModal').classList.add('hidden');
  } else {
    toast('Erro ao conectar. Verifique as credenciais.', 'error');
  }
}

// ============================================================
//  TABS
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.op-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.op-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  const tabMap = { login: 0, cadastro: 1, lista: 2 };
  document.querySelectorAll('.op-tab')[tabMap[tab]]?.classList.add('active');
  if (tab === 'lista') carregarClientes();
}

// ============================================================
//  TOAST
// ============================================================
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ============================================================
//  MASKS
// ============================================================
function maskCPF(input) {
  let v = input.value.replace(/\D/g, '');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  input.value = v;
}

function maskPhone(input) {
  let v = input.value.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');
  input.value = v;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0, rem;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i-1]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i-1]) * (12 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(cpf[10]);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
//  SCROLL REVEAL
// ============================================================
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  initReveal();

  // Mostrar botão de config Supabase se não configurado
  if (!localStorage.getItem('sb_url')) {
    const tip = document.createElement('div');
    tip.style.cssText = `
      position:fixed;bottom:1.5rem;left:1.5rem;z-index:9998;
      background:var(--blue);color:white;border-radius:10px;
      padding:0.75rem 1.2rem;font-size:0.82rem;font-weight:600;
      cursor:pointer;box-shadow:0 8px 24px rgba(0,48,135,0.3);
      display:flex;align-items:center;gap:8px;
    `;
    tip.innerHTML = '⚙️ Configurar Supabase';
    tip.onclick = () => document.getElementById('configModal').classList.remove('hidden');
    document.body.appendChild(tip);
  }
});

// ============================================================
//  SETUP SUPABASE — INSTRUÇÕES
// ============================================================
/*
  COMO CONFIGURAR O SUPABASE:
  
  1. Acesse https://supabase.com e crie uma conta
  2. Crie um novo projeto
  3. Vá em Settings → API e copie:
     - Project URL
     - anon public key
  4. Clique no botão "⚙️ Configurar Supabase" que aparece no canto
     inferior esquerdo da tela, ou preencha diretamente aqui:

  const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
  const SUPABASE_KEY = 'SUA_ANON_KEY';

  5. No Supabase, crie as tabelas com o SQL abaixo:
  
  -- Tabela de clientes
  CREATE TABLE clientes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text NOT NULL,
    cpf text NOT NULL,
    telefone text NOT NULL,
    email text,
    endereco text NOT NULL,
    cidade text NOT NULL,
    estado text,
    produto text NOT NULL,
    obs text,
    atendente text,
    atendente_user text,
    criado_em timestamptz DEFAULT now()
  );

  -- Tabela de contatos
  CREATE TABLE contatos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text,
    telefone text,
    mensagem text,
    criado_em timestamptz DEFAULT now()
  );

  -- Habilitar acesso público (Row Level Security)
  ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "allow_all" ON clientes FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "allow_all" ON contatos FOR ALL USING (true) WITH CHECK (true);
*/

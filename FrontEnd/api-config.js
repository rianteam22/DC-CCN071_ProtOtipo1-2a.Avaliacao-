// Configuração de API para comunicação com backend

// URL base da API - muda automaticamente entre desenvolvimento e produção
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3333'
  : `${window.location.protocol}//${window.location.hostname}`;

// Chave para armazenar dados do usuário no localStorage
const USER_STORAGE_KEY = 'currentUser';

/**
 * Função auxiliar para fazer requisições HTTP
 * @param {string} endpoint - Endpoint da API (ex: '/login', '/register')
 * @param {object} options - Opções do fetch (method, body, etc)
 * @returns {Promise<object>} - Resposta da API
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Erro HTTP: ${response.status}`);
    }

    return data;

  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

/**
 * Salva dados do usuário no localStorage
 * @param {object} userData - Dados do usuário
 */
function saveUser(userData) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
}

/**
 * Recupera dados do usuário do localStorage
 * @returns {object|null} - Dados do usuário ou null
 */
function getUser() {
  const userData = localStorage.getItem(USER_STORAGE_KEY);
  return userData ? JSON.parse(userData) : null;
}

/**
 * Remove dados do usuário do localStorage
 */
function clearUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Verifica se há um usuário logado
 * @returns {boolean}
 */
function isLoggedIn() {
  return getUser() !== null;
}

// API Functions

/**
 * Registra um novo usuário
 * @param {string} email
 * @param {string} senha
 * @returns {Promise<object>}
 */
async function register(email, senha) {
  const data = await apiRequest('/register', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });

  // Salvar usuário no localStorage após registro bem-sucedido
  if (data.user) {
    saveUser(data.user);
  }

  return data;
}

/**
 * Faz login de um usuário
 * @param {string} email
 * @param {string} senha
 * @returns {Promise<object>}
 */
async function login(email, senha) {
  const data = await apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });

  // Salvar usuário no localStorage após login bem-sucedido
  if (data.user) {
    saveUser(data.user);
  }

  return data;
}

/**
 * Busca perfil do usuário
 * @param {string} email
 * @returns {Promise<object>}
 */
async function getProfile(email) {
  const data = await apiRequest(`/profile?email=${encodeURIComponent(email)}`, {
    method: 'GET'
  });

  return data;
}

/**
 * Atualiza perfil do usuário
 * @param {object} profileData - Dados do perfil a atualizar
 * @returns {Promise<object>}
 */
async function updateProfile(profileData) {
  const data = await apiRequest('/profile/update', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });

  // Atualizar dados no localStorage após atualização bem-sucedida
  if (data.user) {
    saveUser(data.user);
  }

  return data;
}

/**
 * Faz logout do usuário
 */
function logout() {
  clearUser();
}

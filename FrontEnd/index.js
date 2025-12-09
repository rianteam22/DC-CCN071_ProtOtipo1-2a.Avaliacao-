const server = window.location.hostname === 'localhost'
  ? 'http://localhost:3333'
  : `${window.location.protocol}//${window.location.hostname}`;

// Application State
const appState = {
  currentUser: null,
  token: null
};

//utilidades

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  errorElement.textContent = message;
  errorElement.classList.add('show');
  setTimeout(() => {
    errorElement.classList.remove('show');
  }, 3000);
}

function openSenhaModal(onSubmit) {
  document.getElementById('senhaModal').style.display = 'flex';
  const input = document.getElementById('senhaInput');
  input.value = '';
  input.focus();
  document.getElementById('confirmSenhaBtn').onclick = () => {
    const senha = input.value;
    document.getElementById('senhaModal').style.display = 'none';
    onSubmit(senha);
  };
}
function closeSenhaModal() {
  document.getElementById('senhaModal').style.display = 'none';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    appState.token = token;
    appState.currentUser = JSON.parse(user);
    loadDashboard();
    showPage('dashboardPage');
  } else {
    showPage('loginPage');
  }
}

// LOGIN PAGE

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showError('loginError', 'Preencha todos os campos');
    return;
  }

  try {
    const response = await fetch(`${server}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, senha: password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer login');
    }

    //salvando o token e dados
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    appState.token = data.token;
    appState.currentUser = data.user;

    if (!data.user.user || !data.user.name) {
      // Redirecionar para completar perfil
      document.getElementById('profileEmail').value = data.user.email;
      document.getElementById('profileCreatedAt').value = formatDate(data.user.timestamp_created);
      showPage('profilePage');
    } else {
      // Ir direto para dashboard
      loadDashboard();
      showPage('dashboardPage');
    }

  } catch (error) {
    showError('loginError', error.message);
  }
});

document.getElementById('goToSignup').addEventListener('click', () => {
  showPage('signupPage');
  document.getElementById('signupForm').reset();
});

// SIGNUP PAGE

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  if (!email || !password) {
    showError('signupError', 'Preencha todos os campos');
    return;
  }

  if (password.length < 6) {
    showError('signupError', 'Senha deve ter no mínimo 6 caracteres');
    return;
  }

  try {
    const response = await fetch(`${server}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, senha: password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao criar conta');
    }

    //salvando o token e dados
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    appState.token = data.token;
    appState.currentUser = data.user;

    document.getElementById('profileEmail').value = email;
    document.getElementById('profileCreatedAt').value = formatDate(data.user.timestamp_created);
    showPage('profilePage');

  } catch (error) {
    showError('signupError', error.message);
  }
});

document.getElementById('backToLoginFromSignup').addEventListener('click', () => {
  showPage('loginPage');
  document.getElementById('signupForm').reset();
});

// PROFILE PAGE

async function loadProfileData() {
  const token = localStorage.getItem('token');
  try {
    const resp = await fetch(`${server}/profile/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Sessão expirada');
    const data = await resp.json();
    const usuario = data.user;
    if (!usuario) throw new Error('Usuário não encontrado');
    // Preencher campos
    document.getElementById('profileName').value = usuario.name || '';
    document.getElementById('profileUsername').value = usuario.user || '';
    document.getElementById('profileDescription').value = usuario.description || '';
    document.getElementById('profileEmail').value = usuario.email;
    document.getElementById('profileCreatedAt').value = formatDate(usuario.timestamp_created);
    document.getElementById('profilePhotoDisplay').style.backgroundImage = usuario.profile_pic ? `url(${usuario.profile_pic})` : 'none';
    if (usuario.profile_pic) {
      document.getElementById('photoPlaceholder').style.display = 'none';
    } else {
      document.getElementById('photoPlaceholder').style.display = 'flex';
    }
  } catch (error) {
    showError('profileError', error.message);
  }
}


document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  
  if (!file) return;
  
  // Validar arquivo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showError('profileError', 'Apenas imagens são permitidas (jpg, png, gif, webp)');
    return;
  }
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showError('profileError', 'Arquivo muito grande. Máximo 5MB');
    return;
  }
  
  // Preview local
  const reader = new FileReader();
  reader.onload = (event) => {
    const photoDisplay = document.getElementById('profilePhotoDisplay');
    photoDisplay.style.backgroundImage = `url(${event.target.result})`;
    photoDisplay.style.backgroundSize = 'cover';
    photoDisplay.style.backgroundPosition = 'center';
    document.getElementById('photoPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
  
  // Feedback de loading
  const uploadBtn = document.getElementById('uploadPhotoBtn');
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = 'Enviando...';
  uploadBtn.disabled = true;
  
  try {
    const token = localStorage.getItem('token');
    
    const formData = new FormData();
    formData.append('profile_pic', file);
    
    const uploadResponse = await fetch(`${server}/profile/upload-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}` // ✅ Token identifica o usuário
      },
      body: formData
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      throw new Error(uploadResult.error || 'Erro ao fazer upload');
    }
    
    localStorage.setItem('user', JSON.stringify(uploadResult.user));
    appState.currentUser = uploadResult.user;
    
    // Feedback de sucesso
    uploadBtn.textContent = '✓ Foto atualizada!';
    setTimeout(() => {
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    showError('profileError', 'Erro ao fazer upload: ' + error.message);
    
    // Reverter em caso de erro
    uploadBtn.textContent = originalText;
    uploadBtn.disabled = false;
    document.getElementById('photoPlaceholder').style.display = 'flex';
  }
});

//update do profile
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('profileName').value.trim();
  const username = document.getElementById('profileUsername').value.trim();
  const description = document.getElementById('profileDescription').value.trim();
  const newPassword = document.getElementById('profilePassword').value;
  const newEmail = document.getElementById('profileNewEmail').value.trim();

  try {
    const token = localStorage.getItem('token');


    const profileData = {
      name: name,
      user: username,
      description: description
    };

    //pedir senha
    // email
    if (newEmail) {
      profileData.novoEmail = newEmail;
    }
    if (newPassword) {
      profileData.novaSenha = newPassword;
    }
    if (newEmail || newPassword) {
        await new Promise((resolve, reject) => {
        openSenhaModal((senha) => {
          if (!senha) {
            reject(new Error('Senha é obrigatória para alterar email ou senha'));
          } else {
            profileData.senhaAtual = senha;
            resolve();
          }
        });
    }, 500);
}

    // Enviar atualização de perfil
    const profileResponse = await fetch(`${server}/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });

    const profileResult = await profileResponse.json();

    if (!profileResponse.ok) {
      throw new Error(profileResult.error || 'Erro ao atualizar perfil');
    }

    // Atualizar localStorage
    localStorage.setItem('user', JSON.stringify(profileResult.user));
    appState.currentUser = profileResult.user;

    // Ir para dashboard
    loadDashboard();
    showPage('dashboardPage');

  } catch (error) {
    showError('profileError', error.message);
  }
});

document.getElementById('skipProfile').addEventListener('click', () => {
  loadDashboard();
  showPage('dashboardPage');
});

// DASHBOARD PAGE

async function loadDashboard() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${server}/profile/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Sessão expirada');
    }

    const data = await response.json();
    
    // Atualizar dados
    localStorage.setItem('user', JSON.stringify(data.user));
    appState.currentUser = data.user;

    renderDashboard();

  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    logout();
  }
}

function renderDashboard() {
  const user = appState.currentUser;
  
  if (!user) return;

  const dashboardTitle = document.querySelector('.dashboard-title');
  if (dashboardTitle) {
    dashboardTitle.textContent = `Bem-vindo, ${user.name || user.email}!`;
  }

  // Você pode adicionar mais conteúdo dinâmico aqui
  const itemsContainer = document.getElementById('itemsContainer');
  // teste de carregamento dos dados
  itemsContainer.innerHTML = `
    <div class="user-info-card" style="background: var(--color-surface); padding: var(--space-24); border-radius: var(--radius-lg); margin-bottom: var(--space-24); border: 1px solid var(--color-border);">
      <h3 style="margin-bottom: var(--space-16); color: var(--color-text);">Informações do Perfil</h3>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Username:</strong> ${user.user || 'Não definido'}</p>
      <p><strong>Nome:</strong> ${user.name || 'Não definido'}</p>
      <p><strong>Descrição:</strong> ${user.description || 'Sem descrição'}</p>
      <p><strong>Conta criada em:</strong> ${formatDate(user.timestamp_created)}</p>
      ${user.profile_pic ? `<p><strong>Foto de perfil:</strong> <img src="${user.profile_pic}" alt="Foto" style="max-width: 100px; border-radius: 50%; margin-top: 8px;"></p>` : ''}
    </div>
    
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-text">Nenhum item encontrado</div>
      <p style="margin-top: var(--space-12); color: var(--color-text-secondary);">Use a busca acima para encontrar itens</p>
    </div>
  `;
}

document.getElementById('profileBtn').addEventListener('click', () => {
  showPage('profilePage');
  loadProfileData();
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  logout();
});

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  appState.token = null;
  appState.currentUser = null;
  showPage('loginPage');
  document.getElementById('loginForm').reset();
}

window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// Configuração do servidor para funcionar com Load Balancer (AWS ALB)
// - Em desenvolvimento local: usa localhost:3333
// - Em produção (atrás do ALB): usa a origem atual (protocolo + host)
// - Suporta qualquer hostname/IP dinâmico do ALB
const server = (() => {
  const { hostname, protocol, port } = window.location;
  
  // Desenvolvimento local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3333';
  }
  
  // Produção: usar origem atual (funciona com ALB, IP público, ou domínio)
  // O ALB faz proxy para as instâncias, então usamos a mesma origem
  const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
  return `${protocol}//${hostname}${portSuffix}`;
})();

// Application State
const appState = {
  currentUser: null,
  token: null,
  mediaGallery: [],
  mediaStats: {},
  // Estado de paginação
  mediaPagination: {
    currentPage: 1,
    pageSize: 20,
    totalPages: 0,
    totalItems: 0,
    hasNext: false,
    hasPrev: false
  },
  // Estado de filtros
  mediaFilters: {
    search: '',
    type: '',           // '', 'image', 'video', 'audio'
    sortBy: 'created_at',
    sortOrder: 'DESC'   // 'DESC' = mais recentes, 'ASC' = mais antigos
  }
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

// ===== MEDIA GALLERY FUNCTIONS =====

// Open upload modal
function openUploadModal() {
  document.getElementById('uploadMediaModal').style.display = 'flex';
  document.getElementById('uploadMediaForm').reset();
  document.getElementById('uploadError').style.display = 'none';
  document.getElementById('mediaFileInput').focus();
}

// Close upload modal
function closeUploadModal() {
  document.getElementById('uploadMediaModal').style.display = 'none';
  document.getElementById('uploadMediaForm').reset();
}

// Upload media
async function uploadMedia(e) {
  e.preventDefault();

  const fileInput = document.getElementById('mediaFileInput');
  const title = document.getElementById('mediaTitleInput').value.trim();
  const description = document.getElementById('mediaDescriptionInput').value.trim();
  const uploadBtn = document.getElementById('uploadSubmitBtn');
  const errorDiv = document.getElementById('uploadError');

  if (!fileInput.files || !fileInput.files[0]) {
    errorDiv.textContent = 'Selecione um arquivo';
    errorDiv.style.display = 'block';
    return;
  }

  const file = fileInput.files[0];

  // Validate file size client-side
  const maxSizes = {
    image: 5 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    audio: 20 * 1024 * 1024
  };

  let mediaType = null;
  if (file.type.startsWith('image/')) mediaType = 'image';
  else if (file.type.startsWith('video/')) mediaType = 'video';
  else if (file.type.startsWith('audio/')) mediaType = 'audio';

  if (mediaType && file.size > maxSizes[mediaType]) {
    const maxMB = maxSizes[mediaType] / (1024 * 1024);
    errorDiv.textContent = `Arquivo muito grande. Máximo para ${mediaType}: ${maxMB}MB`;
    errorDiv.style.display = 'block';
    return;
  }

  try {
    errorDiv.style.display = 'none';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Enviando...';

    const formData = new FormData();
    formData.append('media', file);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    const token = localStorage.getItem('token');
    const response = await fetch(`${server}/api/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer upload');
    }

    closeUploadModal();
    // Manter página atual após upload
    await loadMediaGallery(appState.mediaPagination.currentPage);

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  }
}

// Load media gallery from API
async function loadMediaGallery(page = null) {
  const token = localStorage.getItem('token');
  const errorDiv = document.getElementById('mediaGalleryError');

  // Usar page fornecido ou current page do estado
  const currentPage = page !== null ? page : appState.mediaPagination.currentPage;

  try {
    errorDiv.style.display = 'none';

    // Construir URL com todos os parâmetros
    const params = new URLSearchParams();
    params.append('limit', appState.mediaPagination.pageSize);
    params.append('page', currentPage);

    if (appState.mediaFilters.search) {
      params.append('search', appState.mediaFilters.search);
    }
    if (appState.mediaFilters.type) {
      params.append('type', appState.mediaFilters.type);
    }
    params.append('sortBy', appState.mediaFilters.sortBy);
    params.append('sortOrder', appState.mediaFilters.sortOrder);

    const url = `${server}/api/media?${params.toString()}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao carregar mídias');
    }

    // Atualizar estado
    appState.mediaGallery = data.medias || [];
    appState.mediaStats = data.stats || {};
    appState.mediaPagination = {
      currentPage: data.pagination.page,
      pageSize: data.pagination.limit,
      totalPages: data.pagination.pages,
      totalItems: data.pagination.total,
      hasNext: data.pagination.hasNext,
      hasPrev: data.pagination.hasPrev
    };

    renderMediaTable();
    renderPaginationControls();

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

// Navegação de páginas
function goToPage(page) {
  appState.mediaPagination.currentPage = page;
  loadMediaGallery(page);
}

function nextPage() {
  if (appState.mediaPagination.hasNext) {
    goToPage(appState.mediaPagination.currentPage + 1);
  }
}

function prevPage() {
  if (appState.mediaPagination.hasPrev) {
    goToPage(appState.mediaPagination.currentPage - 1);
  }
}

// Aplicar filtros
function applyFilters() {
  // Sempre voltar para página 1 ao aplicar novos filtros
  appState.mediaPagination.currentPage = 1;
  loadMediaGallery(1);
}

// Filtro de tipo
function filterByType(type) {
  appState.mediaFilters.type = type;
  applyFilters();
}

// Ordenação
function sortMedia(sortBy, sortOrder) {
  appState.mediaFilters.sortBy = sortBy;
  appState.mediaFilters.sortOrder = sortOrder;
  applyFilters();
}

// Busca (substitui searchMedia anterior)
const searchMediaDebounced = debounce(function(searchTerm) {
  appState.mediaFilters.search = searchTerm;
  applyFilters();
}, 500);

// Render media table
function renderMediaTable() {
  const tbody = document.getElementById('mediaTableBody');
  const medias = appState.mediaGallery || [];
  const resultsCount = document.getElementById('resultsCount');

  // Atualizar contador de resultados
  const { totalItems, currentPage, pageSize } = appState.mediaPagination;
  const start = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, totalItems);
  resultsCount.textContent = `${start}-${end} de ${totalItems} itens`;

  if (medias.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">
          <div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <div class="empty-state-text">Nenhuma mídia encontrada</div>
            <p style="margin-top: var(--space-12); color: var(--color-text-secondary);">
              Clique em "Upload de Mídia" para começar
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = medias.map(media => {
    const typeIcon = {
      image: '🖼️',
      video: '🎥',
      audio: '🎵'
    }[media.type] || '📄';

    const formattedDate = formatDate(media.created_at);
    const sizeMB = (media.size / (1024 * 1024)).toFixed(2);

    // Gerar célula de preview
    let previewCell = '';

    if (media.thumbnail_url) {
      // Imagens e vídeos com thumbnail
      previewCell = `
        <a href="${media.url}" target="_blank" class="media-preview-link" title="Ver original">
          <img src="${media.thumbnail_url}"
               alt="${media.filename}"
               class="media-thumb"
               loading="lazy" />
        </a>`;
    } else if (media.type === 'audio') {
      // Áudios: ícone
      previewCell = '<span class="audio-icon">🎵</span>';
    } else {
      // Fallback para registros antigos sem thumbnail
      previewCell = '<span class="no-thumb">—</span>';
    }

    const title = media.title || media.filename;

    return `
      <tr class="media-row" data-uuid="${media.uuid}">
        <td class="type-cell">${typeIcon}</td>
        <td class="preview-cell">${previewCell}</td>
        <td class="name-cell">
          <span class="media-name">${title}</span>
          ${media.description ? `<div class="media-desc-small">${media.description}</div>` : ''}
        </td>
        <td class="size-cell">${sizeMB} MB</td>
        <td class="date-cell">${formattedDate}</td>
        <td class="actions-cell">
          <button
            class="btn btn-secondary btn-sm"
            onclick="deleteMedia('${media.uuid}', '${media.filename}')"
            title="Excluir"
          >
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render pagination controls
function renderPaginationControls() {
  const container = document.getElementById('paginationControls');
  const { currentPage, totalPages, hasNext, hasPrev } = appState.mediaPagination;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  // Calcular range de páginas a mostrar (máximo 7 páginas visíveis)
  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  let pagesHTML = '';

  // Primeira página
  if (startPage > 1) {
    pagesHTML += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      pagesHTML += `<span class="page-ellipsis">...</span>`;
    }
  }

  // Páginas intermediárias
  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? 'active' : '';
    pagesHTML += `<button class="page-btn ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
  }

  // Última página
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pagesHTML += `<span class="page-ellipsis">...</span>`;
    }
    pagesHTML += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  container.innerHTML = `
    <div class="pagination-wrapper">
      <button
        class="pagination-btn"
        onclick="prevPage()"
        ${!hasPrev ? 'disabled' : ''}
      >
        ← Anterior
      </button>

      <div class="pagination-pages">
        ${pagesHTML}
      </div>

      <button
        class="pagination-btn"
        onclick="nextPage()"
        ${!hasNext ? 'disabled' : ''}
      >
        Próxima →
      </button>
    </div>
  `;
}

// Delete media
async function deleteMedia(uuid, filename) {
  if (!confirm(`Tem certeza que deseja excluir "${filename}"?\n\nEsta ação é permanente e não pode ser desfeita.`)) {
    return;
  }

  const token = localStorage.getItem('token');
  const errorDiv = document.getElementById('mediaGalleryError');

  try {
    errorDiv.style.display = 'none';

    const response = await fetch(`${server}/api/media/${uuid}?permanent=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao excluir mídia');
    }

    // Smart page adjustment: se deletamos o último item de uma página que não é a primeira,
    // voltar para a página anterior
    const { currentPage } = appState.mediaPagination;
    const itemsOnCurrentPage = appState.mediaGallery.length;

    if (itemsOnCurrentPage === 1 && currentPage > 1) {
      // Deletando último item de uma página que não é a primeira
      await loadMediaGallery(currentPage - 1);
    } else {
      // Caso contrário, manter página atual
      await loadMediaGallery(currentPage);
    }

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

// Debounce utility for search
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
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

  // Load media gallery
  loadMediaGallery();
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

  // Upload media modal listeners
  const uploadMediaBtn = document.getElementById('uploadMediaBtn');
  if (uploadMediaBtn) {
    uploadMediaBtn.addEventListener('click', openUploadModal);
  }

  const uploadMediaForm = document.getElementById('uploadMediaForm');
  if (uploadMediaForm) {
    uploadMediaForm.addEventListener('submit', uploadMedia);
  }

  // Search input listener (atualizado para usar nova função)
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const currentPage = document.querySelector('.page.active').id;
      if (currentPage === 'dashboardPage') {
        searchMediaDebounced(e.target.value);  // Usar nova função debounced
      }
    });
  }

  // Filtro de tipo
  const typeFilter = document.getElementById('typeFilter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      filterByType(e.target.value);
    });
  }

  // Filtro de ordenação
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      const [sortBy, sortOrder] = e.target.value.split('-');
      sortMedia(sortBy, sortOrder);
    });
  }
});

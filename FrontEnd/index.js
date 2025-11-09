
// Application State
const appState = {
    currentUser: null,
    userItems: {}
};

// Utility Functions
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

function showSuccess(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.color = '#22c55e';
    errorElement.classList.add('show');
    setTimeout(() => {
        errorElement.classList.remove('show');
        errorElement.style.color = '';
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Login Page
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await login(email, password);
        appState.currentUser = response.user;
        renderDashboard();
        showPage('dashboardPage');
    } catch (error) {
        showError('loginError', error.message || 'Email ou senha incorretos');
    }
});

document.getElementById('goToSignup').addEventListener('click', () => {
    showPage('signupPage');
    document.getElementById('signupForm').reset();
});

// Signup Page
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    try {
        const response = await register(email, password);
        appState.currentUser = response.user;
        appState.userItems[response.user.uuid] = [];

        // Populate profile form
        document.getElementById('profileEmail').value = email;
        if (response.user.timestamp_created) {
            document.getElementById('profileCreatedAt').value = formatDate(response.user.timestamp_created);
        }

        showSuccess('signupError', 'Conta criada com sucesso!');
        setTimeout(() => {
            showPage('profilePage');
        }, 1000);
    } catch (error) {
        showError('signupError', error.message || 'Erro ao criar conta');
    }
});

document.getElementById('backToLoginFromSignup').addEventListener('click', () => {
    showPage('loginPage');
    document.getElementById('signupForm').reset();
});

// Profile Page
document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
    document.getElementById('photoInput').click();
});

document.getElementById('photoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const photoDisplay = document.getElementById('profilePhotoDisplay');
            photoDisplay.style.backgroundImage = `url(${event.target.result})`;
            photoDisplay.style.backgroundSize = 'cover';
            photoDisplay.style.backgroundPosition = 'center';
            document.getElementById('photoPlaceholder').style.display = 'none';
            // Armazenar base64 temporariamente (em produção, fazer upload real)
            appState.currentUser.profile_pic = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('profileName').value.trim();
    const username = document.getElementById('profileUsername').value.trim();
    const description = document.getElementById('profileDescription').value.trim();
    const newPassword = document.getElementById('profilePassword').value;

    const profileData = {
        emailAtual: appState.currentUser.email,
        name: name,
        user: username,
        description: description,
        pic: appState.currentUser.profile_pic || null
    };

    // Se tiver nova senha, adicionar ao payload
    if (newPassword) {
        // Para atualizar senha, precisamos da senha atual
        // Por simplicidade, vamos pedir a senha atual em um prompt
        const senhaAtual = prompt('Digite sua senha atual para confirmar a alteração:');
        if (!senhaAtual) {
            showError('profileError', 'Senha atual é necessária para alterar dados');
            return;
        }
        profileData.senhaAtual = senhaAtual;
        profileData.novaSenha = newPassword;
    }

    try {
        const response = await updateProfile(profileData);
        appState.currentUser = response.user;
        showSuccess('profileError', response.message || 'Perfil atualizado com sucesso!');
        setTimeout(() => {
            renderDashboard();
            showPage('dashboardPage');
        }, 1000);
    } catch (error) {
        showError('profileError', error.message || 'Erro ao atualizar perfil');
    }
});

document.getElementById('skipProfile').addEventListener('click', () => {
    renderDashboard();
    showPage('dashboardPage');
});

// Dashboard Page
function renderDashboard() {
    const itemsContainer = document.getElementById('itemsContainer');
    const userId = appState.currentUser.uuid || appState.currentUser.id;

    if (!appState.userItems[userId]) {
        appState.userItems[userId] = [];
    }

    const items = appState.userItems[userId];

    if (items.length === 0) {
        itemsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <div class="empty-state-text">Nenhum item encontrado</div>
            </div>
        `;
        return;
    }

    itemsContainer.innerHTML = items.map(item => `
        <div class="item">
            <div class="item-name">${item.name}</div>
            <div class="item-meta">Criado em: ${formatDate(item.createdAt)} • Tamanho: ${item.size}</div>
        </div>
    `).join('');
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const userId = appState.currentUser.uuid || appState.currentUser.id;
    const items = appState.userItems[userId] || [];

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm)
    );

    const itemsContainer = document.getElementById('itemsContainer');

    if (filteredItems.length === 0) {
        itemsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">${searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum item encontrado'}</div>
            </div>
        `;
        return;
    }

    itemsContainer.innerHTML = filteredItems.map(item => `
        <div class="item">
            <div class="item-name">${item.name}</div>
            <div class="item-meta">Criado em: ${formatDate(item.createdAt)} • Tamanho: ${item.size}</div>
        </div>
    `).join('');
});

document.getElementById('profileBtn').addEventListener('click', async () => {
    try {
        // Buscar dados atualizados do backend
        const response = await getProfile(appState.currentUser.email);
        appState.currentUser = response.user;

        // Populate profile form with current user data
        document.getElementById('profileEmail').value = appState.currentUser.email;
        document.getElementById('profileName').value = appState.currentUser.name || '';
        document.getElementById('profileUsername').value = appState.currentUser.user || '';
        document.getElementById('profileDescription').value = appState.currentUser.description || '';
        document.getElementById('profileCreatedAt').value = formatDate(appState.currentUser.timestamp_created);

        if (appState.currentUser.profile_pic) {
            const photoDisplay = document.getElementById('profilePhotoDisplay');
            photoDisplay.style.backgroundImage = `url(${appState.currentUser.profile_pic})`;
            photoDisplay.style.backgroundSize = 'cover';
            photoDisplay.style.backgroundPosition = 'center';
            document.getElementById('photoPlaceholder').style.display = 'none';
        }

        showPage('profilePage');
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        // Mesmo com erro, mostrar a página de perfil com dados em cache
        document.getElementById('profileEmail').value = appState.currentUser.email;
        document.getElementById('profileName').value = appState.currentUser.name || '';
        document.getElementById('profileUsername').value = appState.currentUser.user || '';
        document.getElementById('profileDescription').value = appState.currentUser.description || '';
        showPage('profilePage');
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
    appState.currentUser = null;
    document.getElementById('loginForm').reset();
    document.getElementById('profileForm').reset();
    document.getElementById('searchInput').value = '';
    const photoDisplay = document.getElementById('profilePhotoDisplay');
    photoDisplay.style.backgroundImage = '';
    document.getElementById('photoPlaceholder').style.display = 'block';
    showPage('loginPage');
});

// Initialize app - Check if user is already logged in
function initApp() {
    const savedUser = getUser();
    if (savedUser) {
        appState.currentUser = savedUser;
        renderDashboard();
        showPage('dashboardPage');
    } else {
        showPage('loginPage');
    }
}

// Initialize app when page loads
initApp();

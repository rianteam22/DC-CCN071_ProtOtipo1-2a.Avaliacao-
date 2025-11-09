
// Application State
const appState = {
    currentUser: null,
    users: [],
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

function generateId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Login Page
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const user = appState.users.find(u => u.email === email && u.password === password);

    if (user) {
        appState.currentUser = user;
        renderDashboard();
        showPage('dashboardPage');
    } else {
        showError('loginError', 'Email ou senha incorretos');
    }
});

document.getElementById('goToSignup').addEventListener('click', () => {
    showPage('signupPage');
    document.getElementById('signupForm').reset();
});

// Signup Page
document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (appState.users.find(u => u.email === email)) {
        showError('signupError', 'Este email já está cadastrado');
        return;
    }

    const newUser = {
        id: generateId(),
        email: email,
        password: password,
        createdAt: new Date(),
        name: '',
        username: '',
        description: '',
        photo: null
    };

    appState.users.push(newUser);
    appState.currentUser = newUser;
    appState.userItems[newUser.id] = [];

    // Populate profile form
    document.getElementById('profileEmail').value = email;
    document.getElementById('profileCreatedAt').value = formatDate(newUser.createdAt);

    showPage('profilePage');
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
            appState.currentUser.photo = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    appState.currentUser.name = document.getElementById('profileName').value.trim();
    appState.currentUser.username = document.getElementById('profileUsername').value.trim();
    appState.currentUser.description = document.getElementById('profileDescription').value.trim();
    
    const newPassword = document.getElementById('profilePassword').value;
    if (newPassword) {
        appState.currentUser.password = newPassword;
    }

    renderDashboard();
    showPage('dashboardPage');
});

document.getElementById('skipProfile').addEventListener('click', () => {
    renderDashboard();
    showPage('dashboardPage');
});

// Dashboard Page
function renderDashboard() {
    const itemsContainer = document.getElementById('itemsContainer');
    const userId = appState.currentUser.id;
    
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
    const userId = appState.currentUser.id;
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

document.getElementById('profileBtn').addEventListener('click', () => {
    // Populate profile form with current user data
    document.getElementById('profileEmail').value = appState.currentUser.email;
    document.getElementById('profileName').value = appState.currentUser.name || '';
    document.getElementById('profileUsername').value = appState.currentUser.username || '';
    document.getElementById('profileDescription').value = appState.currentUser.description || '';
    document.getElementById('profileCreatedAt').value = formatDate(appState.currentUser.createdAt);
    
    if (appState.currentUser.photo) {
        const photoDisplay = document.getElementById('profilePhotoDisplay');
        photoDisplay.style.backgroundImage = `url(${appState.currentUser.photo})`;
        photoDisplay.style.backgroundSize = 'cover';
        photoDisplay.style.backgroundPosition = 'center';
        document.getElementById('photoPlaceholder').style.display = 'none';
    }
    
    showPage('profilePage');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    appState.currentUser = null;
    document.getElementById('loginForm').reset();
    document.getElementById('profileForm').reset();
    document.getElementById('searchInput').value = '';
    const photoDisplay = document.getElementById('profilePhotoDisplay');
    photoDisplay.style.backgroundImage = '';
    document.getElementById('photoPlaceholder').style.display = 'block';
    showPage('loginPage');
});

// Initialize with demo data (optional - remove in production)
function initDemoData() {
    const demoUser = {
        id: generateId(),
        email: 'demo@aws.com',
        password: 'demo123',
        createdAt: new Date(),
        name: 'Usuário Demo',
        username: 'demo_user',
        description: 'Conta de demonstração',
        photo: null
    };

    appState.users.push(demoUser);
    appState.userItems[demoUser.id] = [
        {
            name: 'Documento.pdf',
            createdAt: new Date('2024-01-15'),
            size: '2.5 MB'
        },
        {
            name: 'Imagem.jpg',
            createdAt: new Date('2024-02-20'),
            size: '1.8 MB'
        },
        {
            name: 'Apresentacao.pptx',
            createdAt: new Date('2024-03-10'),
            size: '4.2 MB'
        }
    ];
}

// Initialize app
initDemoData();
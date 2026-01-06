import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID 
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').textContent = user.displayName || 'User';
        if (user.photoURL) {
            document.getElementById('userAvatar').src = user.photoURL;
        }

        // Load recent sessions
        await loadRecentSessions();
    } else {
        // Redirect to landing page if not logged in
        window.location.href = 'teachtolearn-final-landing.html';
    }
});

// Load recent sessions from Firestore
async function loadRecentSessions() {
    try {
        const sessionsRef = collection(db, 'users', currentUser.uid, 'sessions');
        const q = query(sessionsRef, orderBy('timestamp', 'desc'), limit(5));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const recentItems = document.getElementById('recentItems');
            recentItems.innerHTML = '';

            querySnapshot.forEach((doc) => {
                const session = doc.data();
                const item = createRecentItem(session, doc.id);
                recentItems.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

// Create recent item element
function createRecentItem(session, id) {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.onclick = () => continueSession(id);

    const timeAgo = getTimeAgo(session.timestamp?.toDate());

    item.innerHTML = `
        <div class="item-icon">🎤</div>
        <div class="item-content">
            <div class="item-title">${session.subject || 'Untitled Session'}</div>
            <div class="item-meta">Last opened ${timeAgo}</div>
        </div>
        <div class="item-arrow">→</div>
    `;

    return item;
}

// Helper function for time ago
function getTimeAgo(date) {
    if (!date) return 'recently';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Continue existing session
function continueSession(sessionId) {
    window.location.href = `app.html?session=${sessionId}`;
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'teachtolearn-final-landing.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Modal handling
const modal = document.getElementById('subjectModal');
const subjectInput = document.getElementById('subjectInput');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalStartBtn = document.getElementById('modalStartBtn');
const teachVoiceCard = document.getElementById('teachVoiceCard');

// Show modal when clicking "Teach Out Loud"
teachVoiceCard.addEventListener('click', () => {
    modal.classList.add('active');
    setTimeout(() => subjectInput.focus(), 100);
});

// Close modal
modalCancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    subjectInput.value = '';
});

// Start teaching
modalStartBtn.addEventListener('click', startTeaching);
subjectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startTeaching();
});

function startTeaching() {
    const subject = subjectInput.value.trim();
    if (!subject) {
        subjectInput.style.borderColor = 'var(--purple-neon)';
        return;
    }

    // Redirect to voice interface with subject
    window.location.href = `app.html?subject=${encodeURIComponent(subject)}`;
}

// Placeholder for other action cards
document.getElementById('uploadDocCard').addEventListener('click', () => {
    alert('Document upload coming soon!');
});

document.getElementById('recordAudioCard').addEventListener('click', () => {
    alert('Audio recording coming soon!');
});

document.getElementById('pasteLinkCard').addEventListener('click', () => {
    alert('Link learning coming soon!');
});

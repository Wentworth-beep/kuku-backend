// ============ FIXED AUTO-LOGIN WITH TOKEN VERIFICATION ============
async function checkAutoLogin() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.log('No token found, user not logged in');
        return false;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/verify-token`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.valid) {
            console.log('Token valid, auto-login successful');
            // Token is valid, get user data
            const userResponse = await fetch(`${BACKEND_URL}/api/user/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userData = await userResponse.json();
            
            if (userResponse.ok) {
                currentUser = {
                    id: data.user.id,
                    username: data.user.username,
                    role: data.user.role,
                    ...userData
                };
                
                // Show game UI
                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('gameApp').classList.remove('hidden');
                
                // Update UI with user data
                updateUIWithUserData();
                
                return true;
            }
        } else {
            // Token is invalid, clear it
            console.log('Token invalid, clearing storage');
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            return false;
        }
    } catch (error) {
        console.error('Auto-login error:', error);
        localStorage.removeItem('token');
        return false;
    }
}

// Call this on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAutoLogin();
});

// Also add a logout function that clears everything
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    currentUser = null;
    
    // Reset UI
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('gameApp').classList.add('hidden');
    
    // Clear any intervals
    if (sessionInterval) clearInterval(sessionInterval);
    if (banCheckInterval) clearInterval(banCheckInterval);
    
    showNotification('Logged out successfully', 'success');
}

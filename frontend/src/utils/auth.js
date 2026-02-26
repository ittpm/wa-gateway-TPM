// Helper: Decode JWT token dari localStorage untuk mendapatkan info user (termasuk role)
export function getCurrentUser() {
    try {
        const token = localStorage.getItem('token')
        if (!token) return null
        const payload = JSON.parse(atob(token.split('.')[1]))
        // Check token expiry
        if (payload.exp && Date.now() >= payload.exp * 1000) return null
        return payload // { id, username, role }
    } catch {
        return null
    }
}

export function getCurrentRole() {
    const user = getCurrentUser()
    return user?.role || null
}

export function isSuperadmin() {
    return getCurrentRole() === 'superadmin'
}

export interface User {
    id: string;
    username: string;
    password?: string; // Optional for security when returning user object
    role: 'superadmin' | 'admin';
    createdAt: Date;
    updatedAt: Date;
}

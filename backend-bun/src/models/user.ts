export interface User {
    id: string;
    username: string;
    password?: string; // Optional for security when returning user object
    role: 'admin' | 'user';
    createdAt: Date;
    updatedAt: Date;
}

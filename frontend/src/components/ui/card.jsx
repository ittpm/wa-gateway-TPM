import React from 'react';

export function Card({ children, className = '', ...props }) {
    return (
        <div
            className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '', ...props }) {
    return (
        <div
            className={`px-6 py-4 border-b border-gray-200 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardContent({ children, className = '', ...props }) {
    return (
        <div
            className={`px-6 py-4 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardFooter({ children, className = '', ...props }) {
    return (
        <div
            className={`px-6 py-4 border-t border-gray-200 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

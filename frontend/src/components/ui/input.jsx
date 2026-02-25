import React from 'react';

export function Input({ className = '', ...props }) {
    return (
        <input
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
            {...props}
        />
    );
}

export function Textarea({ className = '', ...props }) {
    return (
        <textarea
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
            {...props}
        />
    );
}

export function Select({ children, className = '', ...props }) {
    return (
        <select
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
            {...props}
        >
            {children}
        </select>
    );
}

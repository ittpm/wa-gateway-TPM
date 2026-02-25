import React from 'react';

export function Button({ children, className = '', variant = 'default', ...props }) {
    const baseStyles = 'px-4 py-2 rounded-md font-medium transition-colors';

    const variantStyles = {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-gray-300 hover:bg-gray-50',
        ghost: 'hover:bg-gray-100',
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

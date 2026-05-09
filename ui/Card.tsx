
import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-white dark:bg-gray-800 shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden ${className}`}>
            {children}
        </div>
    );
};

export default Card;

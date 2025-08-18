import type { Character } from '../entities/character/types';
import { Bot } from 'lucide-react';

export const Avatar = ({ char, size = 'md' }: { char: Character; size?: 'md' | 'sm' | 'lg' }) => {
    const sizeClasses = { sm: 'w-10 h-10 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-lg' }[size];
    if (char?.avatar && char.avatar.startsWith('data:image')) {
        return <img src={char.avatar} alt={char.name} className={`${sizeClasses} rounded-full object-cover`} />;
    }
    const initial = char.name[0] || <Bot />;
    return (
        <div className={`${sizeClasses} bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-white font-medium`}>
            {initial}
        </div>
    );
};

import type { Character } from '../entities/character/types';
import { Bot } from 'lucide-react';

export const Avatar = ({ char, size = 'md' }: { char: Character; size?: 'md' | 'sm' | 'lg' | 'xs' | '2xs' }) => {
    const sizeClasses = { xs: 'w-8 h-8 text-xs', sm: 'w-10 h-10 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-lg', '2xs': 'w-7 h-7 text-xs' }[size];
    if (char?.avatar && char.avatar.startsWith('data:image')) {
        return (
            <div className={`${sizeClasses} relative aspect-square rounded-full overflow-hidden`}>
                <img src={char.avatar} alt={char.name} className="absolute inset-0 w-full h-full object-cover" />
            </div>
        );
    }
    const initial = char.name[0] || <Bot />;
    return (
        <div className={`${sizeClasses} aspect-square bg-gradient-to-br from-[var(--color-avatar-from)] to-[var(--color-avatar-to)] rounded-full flex items-center justify-center text-[var(--color-text-accent)] font-medium overflow-hidden`}>
            {initial}
        </div>
    );
};

export const GroupChatAvatar = ({ participants }: { participants: (Character | undefined)[] }) => {
    // Limit to 4 avatars for display
    const avatarParticipants = participants.slice(0, 4);
    const renderAvatars = () => {
        const count = avatarParticipants.length;
        if (count === 0) {
            return (
                <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-group-from)] to-[var(--color-group-to)] rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-[var(--color-text-accent)]" />
                </div>
            );
        }
        if (count === 1) {
            return (
                <div className="w-12 h-12 flex items-center justify-center">
                    {avatarParticipants[0] && <Avatar char={avatarParticipants[0]} size="md" />}
                </div>
            );
        }
        if (count === 2) {
            return (
                <div className="w-12 h-12 relative">
                    <div className="absolute left-0 top-0 z-10">
                        {avatarParticipants[0] && <Avatar char={avatarParticipants[0]} size="xs" />}
                    </div>
                    <div className="absolute right-0 bottom-0 z-20">
                        {avatarParticipants[1] && <Avatar char={avatarParticipants[1]} size="xs" />}
                    </div>
                </div>
            );
        }
        if (count === 3) {
            return (
                <div className="w-12 h-12 relative">
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
                        {avatarParticipants[0] && <Avatar char={avatarParticipants[0]} size="2xs" />}
                    </div>
                    <div className="absolute left-0 bottom-0 z-20">
                        {avatarParticipants[1] && <Avatar char={avatarParticipants[1]} size="2xs" />}
                    </div>
                    <div className="absolute right-0 bottom-0 z-30">
                        {avatarParticipants[2] && <Avatar char={avatarParticipants[2]} size="2xs" />}
                    </div>
                </div>
            );
        }
        // 4 or more
        return (
            <div className="w-12 h-12 grid grid-cols-2 grid-rows-2 gap-0.5">
                {avatarParticipants.map((c) =>
                    c ? (
                        <div
                            key={c.id}
                            className="flex items-center justify-center rounded-full overflow-hidden"
                        >
                            <Avatar char={c} size="xs" />
                        </div>
                    ) : null
                )}
            </div>
        );
    };

    return <>{renderAvatars()}</>;
}
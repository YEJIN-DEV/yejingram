import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { selectCharacterById } from '../../entities/character/selectors';

interface SenderNameProps {
    authorId: number;
}

const SenderName: React.FC<SenderNameProps> = ({ authorId }) => {
    const sender = useSelector((state: RootState) => selectCharacterById(state, authorId));
    return <>{sender ? sender.name : authorId}</>;
};

export default SenderName;

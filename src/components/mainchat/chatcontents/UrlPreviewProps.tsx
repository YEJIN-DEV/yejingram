import { useEffect, useState } from "react";

// URL Preview Component
interface UrlPreviewProps {
    url: string;
}

export const UrlPreview: React.FC<UrlPreviewProps> = ({ url }) => {
    const [ogData, setOgData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        const fetchOgData = async () => {
            try {
                const apiUrl = import.meta.env.VITE_OG_API_URL;
                const response = await fetch(`${apiUrl}/og?url=${encodeURIComponent(url)}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch OG data');
                }
                const data = await response.json();
                setOgData(data);
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchOgData();
    }, [url]);

    if (loading) {
        return null;
    }

    if (error || !ogData) {
        return null;
    }

    const title = ogData.og?.ogTitle;
    const description = ogData.og?.ogDescription;
    const image = ogData.og?.ogImage?.[0]?.url;
    const siteUrl = ogData.og?.requestUrl || ogData.fetch?.url || url;

    return (
        <div className="mt-2 p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors max-w-md cursor-pointer" onClick={() => window.open(siteUrl, '_blank')}>
            {image && !imageError && (
                <img
                    src={image.startsWith('//') ? `https:${image}` : image}
                    alt={title}
                    className="w-full h-32 object-cover rounded mb-2"
                    onError={() => setImageError(true)}
                />
            )}
            <div className="text-sm">
                {title && <div className="font-semibold text-gray-900 mb-1">{title}</div>}
                {description && <div className="text-gray-600 line-clamp-2">{description}</div>}
                <div className="text-gray-500 text-xs mt-1 truncate">{siteUrl}</div>
            </div>
        </div>
    );
};
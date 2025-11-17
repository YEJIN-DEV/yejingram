export async function registerProactivePush(clientId: string, serverBaseUrl: string) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return;
        }

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
            return;
        }

        const vapidPublicKey = "BJ5xoic3vp3IzdzUpp2dCra48XsMMYxrhahccCuvapbjMSAcsvrFA3UajU9PWM1fuXEeG2yIaShHaJN1MrBTUFc"

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });

        const baseUrl = serverBaseUrl;

        await fetch(`${baseUrl}/api/push/subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientId,
                ...subscription.toJSON(),
            }),
        });
    } catch (err) {
        console.error('Failed to register service worker or subscribe to push', err);
    }
}

export async function unsubscribeProactivePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!registration) return;

        const existing = await registration.pushManager.getSubscription();
        if (!existing) return;

        await existing.unsubscribe();
    } catch (err) {
        console.error('Failed to unsubscribe from proactive push', err);
    }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}


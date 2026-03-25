import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import NotificationService from '../services/notifications';

const NotificationInboxContext = createContext(null);

export function NotificationInboxProvider({ children, enabled }) {
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnreadCount = useCallback(async () => {
        if (!enabled) {
            setUnreadCount(0);
            return;
        }
        const count = await NotificationService.fetchUnreadCount();
        if (typeof count === 'number' && !Number.isNaN(count)) {
            setUnreadCount(count);
        }
    }, [enabled]);

    useEffect(() => {
        refreshUnreadCount();
    }, [refreshUnreadCount]);

    const value = useMemo(
        () => ({
            unreadCount,
            refreshUnreadCount,
            setUnreadCount
        }),
        [unreadCount, refreshUnreadCount]
    );

    return (
        <NotificationInboxContext.Provider value={value}>{children}</NotificationInboxContext.Provider>
    );
}

export function useNotificationInbox() {
    const ctx = useContext(NotificationInboxContext);
    if (!ctx) {
        throw new Error('useNotificationInbox must be used within NotificationInboxProvider');
    }
    return ctx;
}

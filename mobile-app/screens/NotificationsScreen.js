import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    RefreshControl,
    ActivityIndicator,
    Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import NotificationService from '../services/notifications';
import { executeNotificationPayload } from '../utils/notificationDeepLink';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';
import { useNotificationInbox } from '../contexts/NotificationInboxContext';

// Match TripsListScreen header horizontal padding
const CARD_PADDING = 24;

function formatRelativeTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

export default function NotificationsScreen() {
    const navigation = useNavigation();
    const { refreshUnreadCount } = useNotificationInbox();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const handlingRef = useRef(new Set());

    const loadPage = useCallback(async (cursor, append) => {
        const res = await NotificationService.fetchNotifications({ cursor, limit: 50 });
        if (!res.ok) {
            if (__DEV__) {
                console.warn('fetchNotifications failed', res.error);
            }
            return { error: res.error || 'Failed to load' };
        }
        const list = res.notifications || [];
        setNextCursor(res.nextCursor || null);
        if (append) {
            setItems((prev) => [...prev, ...list]);
        } else {
            setItems(list);
        }
        return { error: null };
    }, []);

    const initialLoad = useCallback(async () => {
        setLoading(true);
        const { error } = await loadPage(null, false);
        setLoading(false);
        if (error) {
            Alert.alert('Notifications', error);
        }
        await refreshUnreadCount();
    }, [loadPage, refreshUnreadCount]);

    useFocusEffect(
        useCallback(() => {
            initialLoad();
        }, [initialLoad])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        const { error } = await loadPage(null, false);
        setRefreshing(false);
        if (error) {
            Alert.alert('Notifications', error);
        }
        await refreshUnreadCount();
    }, [loadPage, refreshUnreadCount]);

    const loadMore = useCallback(async () => {
        if (!nextCursor || loadingMore || loading) return;
        setLoadingMore(true);
        await loadPage(nextCursor, true);
        setLoadingMore(false);
    }, [nextCursor, loadingMore, loading, loadPage]);

    const onPressItem = useCallback(
        async (item) => {
            const id = item.id;
            if (handlingRef.current.has(id)) return;
            handlingRef.current.add(id);
            try {
                const data = { ...(item.data || {}), notificationLogId: item.id };
                const result = await executeNotificationPayload(data, navigation, {
                    skipRecordOpened: false
                });
                if (!result.handled) {
                    Alert.alert(
                        item.title || 'Notification',
                        item.body || 'No further action is available for this notification.'
                    );
                }
                await refreshUnreadCount();
                setItems((prev) =>
                    prev.map((row) =>
                        row.id === id ? { ...row, openedAt: row.openedAt || new Date().toISOString() } : row
                    )
                );
            } finally {
                handlingRef.current.delete(id);
            }
        },
        [navigation, refreshUnreadCount]
    );

    const renderItem = useCallback(
        ({ item }) => {
            const unread = item.openedAt == null;
            return (
                <Pressable
                    onPress={() => onPressItem(item)}
                    style={({ pressed }) => [
                        styles.row,
                        unread && styles.rowUnread,
                        pressed && styles.rowPressed
                    ]}
                >
                    <View style={styles.rowIcon}>
                        <MaterialIcons
                            name={unread ? 'notifications-active' : 'notifications-none'}
                            size={22}
                            color={unread ? colors.primary : colors.text.secondary}
                        />
                    </View>
                    <View style={styles.rowBody}>
                        <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={2}>
                            {item.title || 'Notification'}
                        </Text>
                        {item.body ? (
                            <Text style={styles.body} numberOfLines={3}>
                                {item.body}
                            </Text>
                        ) : null}
                        <Text style={styles.meta}>{formatRelativeTime(item.sentAt)}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.text.light} />
                </Pressable>
            );
        },
        [onPressItem]
    );

    const listHeader = (
        <>
            <StatusBar style="dark" />
            <View style={styles.screenHeader}>
                <Text style={styles.screenHeaderTitle}>Alerts</Text>
            </View>
        </>
    );

    if (loading && items.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {listHeader}
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {listHeader}
            <View style={styles.listWrap}>
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialIcons name="notifications-none" size={48} color={colors.text.light} />
                            <Text style={styles.emptyTitle}>No notifications yet</Text>
                            <Text style={styles.emptySubtitle}>
                                When we send updates about your trips, they will appear here.
                            </Text>
                        </View>
                    }
                    contentContainerStyle={items.length === 0 ? styles.emptyList : styles.listContent}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.card
    },
    screenHeader: {
        paddingTop: spacing.lg + spacing.xs,
        paddingBottom: spacing.md,
        paddingHorizontal: CARD_PADDING,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        position: 'relative'
    },
    screenHeaderTitle: {
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 32,
        color: colors.text.primary,
        textAlign: 'left'
    },
    listWrap: {
        flex: 1,
        backgroundColor: colors.background
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background
    },
    listContent: {
        paddingVertical: spacing.sm
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        marginHorizontal: spacing.md,
        marginVertical: spacing.xs,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderLight
    },
    rowUnread: {
        borderColor: colors.primary,
        borderWidth: 1
    },
    rowPressed: {
        opacity: 0.85
    },
    rowIcon: {
        marginRight: spacing.md
    },
    rowBody: {
        flex: 1,
        minWidth: 0
    },
    title: {
        ...typography.bodySmall,
        fontWeight: '600',
        color: colors.text.primary
    },
    titleUnread: {
        color: colors.text.primary
    },
    body: {
        ...typography.caption,
        color: colors.text.secondary,
        marginTop: spacing.xs
    },
    meta: {
        ...typography.caption,
        color: colors.text.light,
        marginTop: spacing.sm
    },
    emptyList: {
        flexGrow: 1
    },
    empty: {
        flex: 1,
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.text.primary,
        marginTop: spacing.md,
        textAlign: 'center'
    },
    emptySubtitle: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginTop: spacing.sm,
        textAlign: 'center'
    },
    footerLoader: {
        padding: spacing.md
    }
});

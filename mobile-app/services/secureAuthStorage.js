import AsyncStorage from '@react-native-async-storage/async-storage';

/** Same key used on login / AuthContext — single source for persisted session token. */
export const AUTH_TOKEN_STORAGE_KEY = 'authToken';

// expo-secure-store requires a development build; fallback to AsyncStorage only when unavailable.
let SecureStore = null;
let secureStoreAvailable = false;

try {
    SecureStore = require('expo-secure-store');
    secureStoreAvailable = !!SecureStore.getItemAsync;
} catch {
    secureStoreAvailable = false;
}

/**
 * Reads/writes the auth token in the same places AuthContext does (AsyncStorage + SecureStore).
 */
export const secureAuthStorage = {
    async getItem(key) {
        const asyncValue = await AsyncStorage.getItem(key);

        if (secureStoreAvailable && SecureStore) {
            try {
                const secureValue = await SecureStore.getItemAsync(key);
                return secureValue || asyncValue;
            } catch (error) {
                console.warn('SecureStore getItem failed, using AsyncStorage:', error.message);
                return asyncValue;
            }
        }
        return asyncValue;
    },

    async setItem(key, value) {
        await AsyncStorage.setItem(key, value);

        if (secureStoreAvailable && SecureStore) {
            try {
                await SecureStore.setItemAsync(key, value);
            } catch (error) {
                console.warn('SecureStore setItem failed, using AsyncStorage only:', error.message);
            }
        }
    },

    async removeItem(key) {
        await AsyncStorage.removeItem(key).catch(() => {});

        if (secureStoreAvailable && SecureStore) {
            try {
                await SecureStore.deleteItemAsync(key);
            } catch (error) {
                console.warn('SecureStore removeItem failed:', error.message);
            }
        }
    }
};

/**
 * Token as persisted by login / checkAuthState. Use for any code that cannot use in-memory ApiService token.
 */
export async function getPersistedAuthToken() {
    try {
        const token = await secureAuthStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        return token || null;
    } catch (error) {
        if (__DEV__) {
            console.warn('getPersistedAuthToken failed:', error);
        }
        return null;
    }
}

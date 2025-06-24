import { useEffect } from 'react';
import { useUser, useUserActions } from './useUser';
import { usePreferenceActions } from './usePreference';
import { apiClient } from '@/lib/api';
import { userActions } from '@/stores/user';

// Hook for application initialization
export const useAppInit = () => {
  const { isLogin } = useUser();
  const { getCurrentUser } = useUserActions();
  const {
    getCommonPreference,
    getBangumiPreference,
    getCommonPreferenceLocal,
    getBangumiPreferenceLocal,
    setCommonPreference,
    setBangumiPreference,
  } = usePreferenceActions();

  useEffect(() => {
    const initializeApp = async () => {
      let commonPreference = null;
      let bangumiPreference = null;

      // Check if user has stored credentials
      if (apiClient.hasCredential()) {
        try {
          // Try to get user info
          const user = await getCurrentUser();
          userActions.login(user);

          // Load server preferences
          commonPreference = await getCommonPreference();
          bangumiPreference = await getBangumiPreference();
        } catch (error) {
          // If auth fails, clear credentials and fall back to local preferences
          console.error('Authentication failed:', error);
          apiClient.removeCredential();
          userActions.logout();
        }
      }

      // If no server preferences, try local storage
      if (!commonPreference) {
        commonPreference = getCommonPreferenceLocal();
      }
      if (!bangumiPreference) {
        bangumiPreference = getBangumiPreferenceLocal();
      }

      // Set preferences in store
      if (commonPreference) {
        setCommonPreference(commonPreference);
      }
      if (bangumiPreference) {
        setBangumiPreference(bangumiPreference);
      }
    };

    initializeApp().catch(console.error);
  }, []);

  return {
    isLogin,
  };
};

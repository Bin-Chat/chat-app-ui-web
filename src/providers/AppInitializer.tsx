import { useAppDispatch } from '@/hooks/useRedux';
import { fetchProfile } from '@/store/slices';
import { useEffect, useRef } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

export const AppInitializer = () => {
    const dispatch = useAppDispatch();
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Initialize AOS
        AOS.init({
            duration: 700,
            easing: 'ease-out-cubic',
            once: true,
            offset: 50,
        });

        // Only initialize once when component mounts
        if (!hasInitialized.current) {
            hasInitialized.current = true;

            // Check if this is an OAuth callback
            const urlParams = new URLSearchParams(window.location.search);
            const isOAuthCallback =
                urlParams.get('auth') === 'success' || urlParams.get('error');

            // Only fetch profile if user was previously logged in (but not during OAuth callback)
            // OAuth callback will handle auth separately in the login/register page
            const hasLoginFlag =
                localStorage.getItem('userLoggedIn') === 'true';
            if (hasLoginFlag && !isOAuthCallback) {
                dispatch(fetchProfile());
            }
        }
    }, [dispatch]); // Only depend on dispatch

    return null;
};

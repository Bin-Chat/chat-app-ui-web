// Export all slices from a centralized location

export { default as authReducer } from './authSlice';
// Export named auth actions and thunks (tránh TS4094 với export *)
export { fetchProfile, logoutUser, setIsLogging, setUser, setAuth } from './authSlice';
export type { AuthState } from './authSlice';

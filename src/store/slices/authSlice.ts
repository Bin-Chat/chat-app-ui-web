import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authServices } from "@/services/authServices";
import type { User } from "@/types/user.type";

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isLoggedIn?: boolean;
}

const initialState: AuthState = {
  user: null, // Always null on init - must fetch from server
  loading: localStorage.getItem("userLoggedIn") === "true", // Start loading if logged in
  error: null,
  isLoggedIn: localStorage.getItem("userLoggedIn") === "true",
};

// Get user profile thunk
export const fetchProfile = createAsyncThunk<User, void, { rejectValue: string }>(
  "auth/fetchProfile",
  async (_, thunkAPI) => {
    try {
      const res = await authServices.getProfile();

      return res.data.user;
    } catch (err: unknown) {
      if (err instanceof Error) {
        return thunkAPI.rejectWithValue(err.message);
      }
      return thunkAPI.rejectWithValue("Failed to fetch profile");
    }
  }
);

// Logout thunk
export const logoutUser = createAsyncThunk<void, void, { rejectValue: string }>(
  "auth/logoutUser",
  async (_, thunkAPI) => {
    try {
      await authServices.logout();
      return;
    } catch (err: unknown) {
      if (err instanceof Error) {
        return thunkAPI.rejectWithValue(err.message);
      }
      return thunkAPI.rejectWithValue("Failed to logout");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setIsLogging: (state, action) => {
      state.isLoggedIn = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setAuth: (state, action) => {
      state.user = action.payload.user;
      state.isLoggedIn = action.payload.isLoggedIn;
      // Only store login flag - never store user data in localStorage
      if (action.payload.isLoggedIn) {
        localStorage.setItem("userLoggedIn", "true");
      } else {
        localStorage.removeItem("userLoggedIn");
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Get profile
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        localStorage.setItem("userLoggedIn", "true");
        state.user = action.payload;
        state.loading = false;
        state.isLoggedIn = true;
        state.error = null;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        localStorage.removeItem("userLoggedIn");
        state.loading = false;
        state.error = action.payload as string;
        state.isLoggedIn = false;
        state.user = null;
      });

    // Logout
    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        localStorage.removeItem("userLoggedIn");
        state.loading = false;
        state.isLoggedIn = false;
        state.user = null;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setIsLogging, setUser, setAuth } = authSlice.actions;
export default authSlice.reducer;

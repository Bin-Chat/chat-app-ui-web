import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { authReducer } from "./slices";
import { setAppStore } from "@/utils/authorizedAxios";

const rootReducer = combineReducers({
  auth: authReducer,
});

// Configure store
export const store = configureStore({
  reducer: rootReducer,
});

// Inject store vào axios sau khi store được tạo
setAppStore(store);

// Types
export type RootState = ReturnType<typeof store.getState>; // type initialState
export type AppDispatch = typeof store.dispatch; // type khi dispatch
export type AppStore = typeof store;

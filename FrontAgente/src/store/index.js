import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import realtimeReducer from './slices/realtimeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    realtime: realtimeReducer
  }
});

import { createSlice } from '@reduxjs/toolkit';
import { getStoredAuthSession } from '../../utils/authSession';

const storedSession = getStoredAuthSession();

const initialState = {
  token: storedSession?.token || '',
  user: storedSession?.user || null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    clearSession(state) {
      state.token = '';
      state.user = null;
    }
  }
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;

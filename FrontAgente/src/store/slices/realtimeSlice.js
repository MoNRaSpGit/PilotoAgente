import { createSlice } from '@reduxjs/toolkit';

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState: {
    status: 'idle',
    events: []
  },
  reducers: {
    setRealtimeStatus(state, action) {
      state.status = action.payload;
    },
    pushEvent(state, action) {
      state.events.unshift(action.payload);
      state.events = state.events.slice(0, 10);
    }
  }
});

export const { pushEvent, setRealtimeStatus } = realtimeSlice.actions;
export default realtimeSlice.reducer;

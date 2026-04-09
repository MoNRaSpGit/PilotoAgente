import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { API_URL } from '../services/api';
import { pushEvent, setRealtimeStatus } from '../store/slices/realtimeSlice';

export function useRealtimeFeed() {
  const dispatch = useDispatch();

  useEffect(() => {
    const source = new EventSource(`${API_URL}/api/events`);

    source.onopen = () => {
      dispatch(setRealtimeStatus('connected'));
    };

    source.onmessage = (event) => {
      dispatch(pushEvent(JSON.parse(event.data)));
    };

    source.onerror = () => {
      dispatch(setRealtimeStatus('error'));
      source.close();
    };

    return () => {
      dispatch(setRealtimeStatus('disconnected'));
      source.close();
    };
  }, [dispatch]);
}

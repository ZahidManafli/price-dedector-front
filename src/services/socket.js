import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket = null;

// One shared connection for the whole app — chat panels join/leave ticket
// rooms on this socket rather than each opening its own connection.
export function getSocket() {
  if (socket) return socket;

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  socket = io(API_BASE_URL, {
    path: '/socket.io',
    auth: { token },
    autoConnect: !!token,
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

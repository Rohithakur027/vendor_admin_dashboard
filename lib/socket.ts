import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket() can only be called in the browser");
  }
  if (socket?.connected) return socket;

  const token = localStorage.getItem("auth_token");

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(API_URL, {
    auth:        { token },
    autoConnect: true,
    transports:  ["websocket", "polling"],
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config/env.js';

export function initializeSocket(server: HttpServer): Server {
  const io = new Server(server);
  if (config.app.mode === 'development') {
    io.on('connection', (socket) => {
      console.info(`[socket] connected ${socket.id}`);
      socket.on('disconnect', (reason) => console.info(`[socket] disconnected ${socket.id}: ${reason}`));
    });
  }
  return io;
}

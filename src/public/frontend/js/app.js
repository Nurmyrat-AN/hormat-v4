/* global io, jQuery */
(() => {
  'use strict';
  jQuery(() => {
    const socket = io();
    // Keep this area's connection available for future real-time handlers.
    window.frontendSocket = socket;
    if (document.body.dataset.development === 'true') {
      socket.on('connect', () => console.info('[frontend socket] connected', socket.id));
      socket.on('disconnect', (reason) => console.info('[frontend socket] disconnected', reason));
      socket.on('connect_error', (error) => console.error('[frontend socket]', error.message));
    }
  });
})();

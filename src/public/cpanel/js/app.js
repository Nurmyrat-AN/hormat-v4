/* global io, jQuery */
(() => {
  'use strict';
  jQuery(() => {
    const socket = io();
    // Keep this area's connection available for future real-time handlers.
    window.cpanelSocket = socket;
    if (document.body.dataset.development === 'true') {
      socket.on('connect', () => console.info('[cpanel socket] connected', socket.id));
      socket.on('disconnect', (reason) => console.info('[cpanel socket] disconnected', reason));
      socket.on('connect_error', (error) => console.error('[cpanel socket]', error.message));
    }
  });
})();

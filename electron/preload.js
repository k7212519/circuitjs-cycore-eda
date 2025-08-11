const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('cycore', {
  version: '1.1.0'
}); 
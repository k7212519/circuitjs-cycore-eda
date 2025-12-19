const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('cycore', {
  version: '1.2.0'
}); 
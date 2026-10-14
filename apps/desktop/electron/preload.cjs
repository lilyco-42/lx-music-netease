/**
 * 预加载脚本：把受控的原生能力暴露给渲染层。
 * 渲染层据此组装 @lxmn/platform-desktop 的 http / storage。
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lxmnNative', {
  request: (options) => ipcRenderer.invoke('lxmn:request', options),
  storage: {
    get: (k) => ipcRenderer.invoke('lxmn:storage:get', k),
    set: (k, v) => ipcRenderer.invoke('lxmn:storage:set', k, v),
    remove: (k) => ipcRenderer.invoke('lxmn:storage:remove', k),
    keys: () => ipcRenderer.invoke('lxmn:storage:keys'),
  },
  appInfo: () => ipcRenderer.invoke('lxmn:app:info'),
})

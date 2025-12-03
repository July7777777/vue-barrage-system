// 将原来的ES模块导入方式
// import DanmakuWebSocket from "./danmaku-websocket.min.js";

// 修改为动态导入或者直接使用全局变量
// 方式1：使用动态导入（更现代的方式）
let DanmakuWebSocket: any;
import("./danmaku-websocket.min.js").then(module => {
  DanmakuWebSocket = module.default || window['DanmakuWebSocket'];
});

// 或者方式2：假设它是全局变量
// let DanmakuWebSocket: any = (window as any).DanmakuWebSocket;

// let ws: any
let ws: typeof DanmakuWebSocket.prototype

// 添加消息处理器数组
const messageHandlers: Array<(res: { data: { msg: any; msg_id: any; uname: any } }) => void> = [];

/**
 * 创建socket长连接
 * @param authBody
 * @param wssLinks
 */
function createSocket(authBody: string, wssLinks: string[]) {
    const opt = {
        ...getWebSocketConfig(authBody, wssLinks),
        // 收到消息,
        onReceivedMessage: (res: { data: { msg: any; msg_id: any; uname: any } }) => {
            console.log(res);
            // 调用所有注册的消息处理器
            messageHandlers.forEach(handler => handler(res));
        },
        // 收到心跳处理回调
        onHeartBeatReply: (data: any) => console.log("收到心跳处理回调:", data),
        onError: (data: any) => console.log("error", data),
        onListConnectError: () => {
            console.log("list connect error")
            destroySocket()
        },
    }

    if (!ws) {
        ws = new DanmakuWebSocket(opt as any)
    }

    return ws
}

/**
 * 注册消息处理器
 * @param handler 消息处理函数
 * @returns 取消注册的函数
 */
function onMessage(handler: (res: { data: { msg: any; msg_id: any; uname: any } }) => void): () => void {
    messageHandlers.push(handler);
    // 返回取消注册的函数
    return () => {
        const index = messageHandlers.indexOf(handler);
        if (index > -1) {
            messageHandlers.splice(index, 1);
        }
    };
}

/**
 * 获取websocket配置信息
 * @param authBody
 * @param wssLinks
 */
function getWebSocketConfig(authBody: string, wssLinks: string[]) {
    const url = wssLinks[0]
    const urlList = wssLinks
    const auth_body = JSON.parse(authBody)
    return {
        url,
        urlList,
        customAuthParam: [
            {
                key: "key",
                value: auth_body.key,
                type: "string",
            },
            {
                key: "group",
                value: auth_body.group,
                type: "string",
            },
        ],
        rid: auth_body.roomid,
        protover: auth_body.protoover,
        uid: auth_body.uid,
    }
}

/**
 * 销毁websocket
 */
function destroySocket() {
    console.log("destroy1")
    ws && ws.destroy()
    ws = undefined as any
    // 清空消息处理器
    messageHandlers.length = 0;
    console.log("destroy2")
}

/**
 * 获取websocket实例
 */
function getWsClient() {
    return ws
}

// 导出onMessage函数
export { createSocket, destroySocket, getWebSocketConfig, getWsClient, onMessage }
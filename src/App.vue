<template>
  <div class="app">
    <!-- <header>
      <h1>🎯 Vue 3 高性能动态弹幕系统</h1>
      <p>支持滚动/顶部/底部弹幕 · 自动避让 · 节流控制</p>
    </header> -->

    <!-- 弹幕区域 -->
    <Barrage ref="barrageRef" />

    <!-- 控制面板 -->
    <!-- <div class="panel">
      <input
        v-model="text"
        placeholder="输入内容"
        @keyup.enter="send"
      />
      <select v-model="type">
        <option value="scroll">滚动</option>
        <option value="top">顶部</option>
        <option value="bottom">底部</option>
      </select>
      <input
        v-model="color"
        placeholder="颜色"
      />
      <button @click="send">发送</button>
      <button @click="welcome">欢迎新人</button>
    </div> -->
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import Barrage from './components/Barrage.vue';
  import axios from 'axios';
  import selfId from './selfId';
  import { createSocket, destroySocket, onMessage } from './socket/index';

  const api = axios.create({
    baseURL: 'http://localhost:3000',
  });

  const appKey = ref(selfId.appKey);
  const appSecret = ref(selfId.appSecret);
  const codeId = ref(selfId.codeId);
  const appId = ref(selfId.appId);

  const gameId = ref('');
  const authBody = ref('');
  const wssLinks = ref([]);
  // heartBeat Timer
  // 修改前
  // const heartBeatTimer = ref<number | undefined>();

  // 修改后
  // 将原来的类型定义
  // const heartBeatTimer = ref<number | NodeJS.Timeout | undefined>();

  // 修改为浏览器环境适用的类型
  const heartBeatTimer = ref<number | undefined>();

  // be ready
  clearInterval(heartBeatTimer.value!);

  const text = ref('');
  const color = ref('#0ff');
  const type = ref<'scroll' | 'top' | 'bottom'>('scroll');
  // 弹幕引用
  const barrageRef = ref<{ addBarrage: Function } | null>(null);

  // 取消消息订阅的函数引用
  let unsubscribeMessage: (() => void) | null = null;
  const parseColorAndMessage = (str: string) => {
    // 正则说明：
    // ^#                → 以 # 开头
    // ([^，,\s\u3000]+) → 第1组：颜色（1个或多个非分隔符字符）
    // [，,\s\u3000]     → 第一个分隔符（逗号或空格）
    // (.*)              → 第2组：后面所有内容作为信息（包括空格等）
    const match = str.match(/^#([^，,\s\u3000]+)[，,\s\u3000](.*)/);

    if (match) {
      return {
        color: match[1],
        message: match[2]
      };
    } else {
      // 不符合格式，返回 null 或抛出错误
      return null;
    }
  }
  // 处理收到的消息
  const handleReceivedMessage = (res: { data: { msg: any; msg_id: any; uname: any } }) => {
    console.log('App.vue 收到消息:', res);
    // 这里可以根据收到的消息内容进行处理
    // 例如，将消息添加到弹幕中
    if (res.data && res.data.msg) {
      const { msg_id, msg, } = res.data
      // const str = "#红，我是最棒的";
      // if (!str.startsWith('#')) return

      const result = parseColorAndMessage(msg);

      if (result) {
        // console.log("颜色:", result.color);   // 红
        // console.log("信息:", result.message); // 我是最棒的
        barrageRef.value?.addBarrage(result.message, {
          id: msg_id,
          color: result.color,
          type: 'scroll',
          // fontSize: 16
        });
      } else {
        console.log("格式不正确");
      }
      // 添加到弹幕
    }
  };

  const handleCreateSocket = () => {
    if (authBody.value && wssLinks.value) {
      createSocket(authBody.value, wssLinks.value);

      // 注册消息处理器
      unsubscribeMessage = onMessage(handleReceivedMessage);
    }
  };

  // 组件卸载时取消消息订阅
  onUnmounted(() => {
    if (unsubscribeMessage) {
      unsubscribeMessage();
    }
    destroySocket();
    if (heartBeatTimer.value) {
      clearInterval(heartBeatTimer.value);
    }
  });

  const send = () => {
    if (!text.value.trim()) return;
    barrageRef.value?.addBarrage(text.value, { color: color.value, type: type.value, fontSize: 16 });
    text.value = '';
  };

  const welcome = () => {
    barrageRef.value?.addBarrage(`🎉 欢迎新用户加入！`, {
      color: 'pink',
      type: 'top',
      fontSize: 18,
    });
  };
  const getAuth = () => {
    api
      .post('/getAuth', {
        appKey: appKey.value,
        appSecret: appSecret.value,
      })
      .then(({ data }) => {
        console.log('-----鉴权成功-----');
        console.log('返回：', data);
        gameStart()
      })
      .catch(err => {
        console.log('-----鉴权失败-----');
      });
  };
  const gameStart = () => {
    api
      .post('/gameStart', {
        code: codeId.value,
        app_id: Number(appId.value),
      })
      .then(({ data }) => {
        if (data.code === 0) {
          const res = data.data;
          const { game_info, websocket_info } = res;
          const { auth_body, wss_link } = websocket_info;
          authBody.value = auth_body;
          wssLinks.value = wss_link;
          console.log('-----游戏开始成功-----');
          console.log('返回GameId：', game_info);
          gameId.value = game_info.game_id;
          // v2改为20s请求心跳一次，不然60s会自动关闭
          heartBeatTimer.value = setInterval(() => {
            heartBeatThis(game_info.game_id);
          }, 20000);
          handleCreateSocket()
        } else {
          console.log('-----游戏开始失败-----');
          console.log('原因：', data);
        }
      })
      .catch(err => {
        console.log('-----游戏开始失败-----');
        console.log(err);
      });
  };
  const heartBeatThis = (game_id: string) => {
    // 心跳 是否成功
    api
      .post('/gameHeartBeat', {
        game_id,
      })
      .then(({ data }) => {
        console.log('-----心跳成功-----');
        console.log('返回：', data);
      })
      .catch(err => {
        console.log('-----心跳失败-----');
      });
  };
  const init = () => {
    getAuth()
  }
  onMounted(() => {
    init()
  })
</script>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: none;
    color: #eee;
    font-family: 'Segoe UI', sans-serif;
  }

  .app {
    /* max-width: 800px; */
    /* min-height: 100vh; */
    /* margin: 0 auto; */
    /* padding: 20px; */
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  header {
    text-align: center;
    margin-bottom: 30px;
  }

  header h1 {
    color: #0af;
    margin-bottom: 10px;
  }

  header p {
    color: #999;
    font-size: 14px;
  }

  .panel {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 20px 0;
    align-items: center;
  }

  input,
  select,
  button {
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #444;
    background: #222;
    color: #fff;
  }

  input:focus,
  select:focus {
    outline: 1px solid #0af;
  }

  footer {
    margin-top: 40px;
    text-align: center;
    color: #666;
    font-size: 12px;
  }
</style>
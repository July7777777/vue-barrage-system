<template>
  <div class="app">
    <header>
      <h1>🎯 Vue 3 高性能动态弹幕系统</h1>
      <p>支持滚动/顶部/底部弹幕 · 自动避让 · 节流控制 · 暂停播放</p>
    </header>

    <!-- 弹幕区域 -->
    <Barrage ref="barrageRef" />

    <!-- 控制面板 -->
    <div class="panel">
      <input v-model="text" placeholder="输入内容" @keyup.enter="send" />
      <select v-model="type">
        <option value="scroll">滚动</option>
        <option value="top">顶部</option>
        <option value="bottom">底部</option>
      </select>
      <input v-model="color" placeholder="颜色" />
      <button @click="send">发送</button>
      <button @click="welcome">欢迎新人</button>
    </div>

    <footer>
      <p>🖱️ 鼠标悬停暂停 | 🔺 视口外自动暂停 | 🚀 高性能渲染</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import Barrage from './components/Barrage.vue';

  const text = ref('');
  const color = ref('#0ff');
  const type = ref<'scroll' | 'top' | 'bottom'>('scroll');
  const barrageRef = ref<{ addBarrage: Function } | null>(null);

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
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
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
    background: #111;
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

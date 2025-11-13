<template>
  <div
    class="barrage-container"
    ref="containerRef"
  >
    <div class="barrage-item bullet-waiting">等待弹幕</div>
    <div class="barrage-item bullet-done">已发送弹幕</div>
    <div class="barrage-item bullet-running">正在发送弹幕</div>
    <!-- 弹幕项 -->
    <!-- <div
      v-for="(item, index) in items"
      :key="item.id"
      class="barrage-item"
      :class="`type-${item.type}`"
      :style="getItemStyle(item)"
      @animationend="onAnimationEnd(index)"
      @webkitAnimationEnd="onAnimationEnd(index)"
    >
      {{ item.text }}
    </div> -->
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue';

  // === 类型定义 ===
  type BarrageType = 'scroll' | 'top' | 'bottom';
  interface BarrageItem {
    id: number;
    text: string;
    color?: string;
    fontSize?: number;
    type: BarrageType;
    duration?: number;
    timestamp: number;
    top?: number;
  }

  // === 响应式数据 ===
  const items = ref<BarrageItem[]>([]);
  const containerRef = ref<HTMLElement | null>(null);
  let idCounter = 0; // 用于生成唯一ID

  // === 配置常量 ===
  const MAX_BARRAGES = 30; // 最大显示数量
  const MAX_PER_SECOND = 8; // 每秒最多显示弹幕数
  const TRACK_HEIGHT = 30; // 轨道高度
  const CONTAINER_HEIGHT = 200; // 容器高度
  const ANIM_MIN = 8; // 最小动画时长
  const ANIM_MAX = 12; // 最大动画时长

  // === 计算轨道数 ===
  const trackCount = computed(() => Math.floor(CONTAINER_HEIGHT / TRACK_HEIGHT));

  // === 获取可用轨道（防重叠）===
  const getAvailableTrack = (): number => {
    const occupied: number[] = [];

    // 收集已占用的轨道
    items.value
      .filter(i => i.type === 'scroll' && i.top !== undefined)
      .forEach(i => {
        const trackIndex = Math.floor((i.top as number) / TRACK_HEIGHT);
        occupied.push(trackIndex);
      });

    // 尝试找到空闲轨道
    for (let i = 0; i < trackCount.value; i++) {
      if (!occupied.includes(i)) {
        return i * TRACK_HEIGHT + TRACK_HEIGHT / 2;
      }
    }

    // 如果没有空闲轨道，随机选择一个
    return Math.floor(Math.random() * trackCount.value) * TRACK_HEIGHT + TRACK_HEIGHT / 2;
  };

  // === 节流控制 ===
  let lastClearTime = Date.now();
  let burstCount = 0;

  // === 添加弹幕 ===
  const addBarrage = (text: string, options: Partial<BarrageItem> = {}) => {
    // 节流控制，限制每秒发送数量
    const now = Date.now();
    if (now - lastClearTime > 1000) {
      burstCount = 0;
      lastClearTime = now;
    }

    if (burstCount >= MAX_PER_SECOND) {
      return; // 超过限制，忽略本次弹幕
    }

    burstCount++;

    // 解构配置，设置默认值
    const { color = '#ffffff', fontSize = 16, type = 'scroll', duration } = options;

    // 创建新弹幕对象
    const newItem: BarrageItem = {
      id: idCounter++,
      text,
      color,
      fontSize,
      type,
      duration,
      timestamp: now,
    };

    // 为滚动弹幕分配轨道
    if (type === 'scroll') {
      newItem.top = getAvailableTrack();
    }

    // FIFO 清理机制，保持弹幕数量在合理范围
    if (items.value.length >= MAX_BARRAGES) {
      const oldestScrollItemIndex = items.value.findIndex(i => i.type === 'scroll');
      if (oldestScrollItemIndex !== -1) {
        items.value.splice(oldestScrollItemIndex, 1);
      } else {
        items.value.shift(); // 移除最早的弹幕
      }
    }

    // 添加新弹幕
    items.value.push(newItem);

    // 自动清理滚动弹幕 - 添加清理时间缓冲区
    if (type === 'scroll') {
      const cleanDuration = (duration || ANIM_MIN + Math.random() * (ANIM_MAX - ANIM_MIN)) + 3; // 增加3秒缓冲区
      setTimeout(() => {
        const index = items.value.findIndex(i => i.id === newItem.id);
        if (index !== -1) {
          items.value.splice(index, 1);
        }
      }, cleanDuration * 1000);
    }
  };

  // === 动画结束清理 ===
  const onAnimationEnd = (index: number) => {
    // 确保索引有效
    if (index >= 0 && index < items.value.length) {
      const item = items.value[index];
      if (item?.type === 'scroll') {
        items.value.splice(index, 1);
      }
    }
  };

  // === 样式计算 ===
  const getItemStyle = (item: BarrageItem) => {
    const base = {
      color: item.color || '#fff',
      fontSize: (item.fontSize || 16) + 'px',
    };

    if (item.type === 'scroll' && item.top !== undefined) {
      const duration = item.duration || ANIM_MIN + Math.random() * (ANIM_MAX - ANIM_MIN);
      return {
        ...base,
        top: item.top + 'px',
        animationDuration: duration + 's',
        willChange: 'transform' as const,
        backfaceVisibility: 'hidden' as const,
      };
    } else if (item.type === 'top') {
      return { ...base, top: '12px', left: '50%', transform: 'translateX(-50%)' };
    } else if (item.type === 'bottom') {
      return { ...base, bottom: '12px', left: '50%', transform: 'translateX(-50%)' };
    }

    return base;
  };

  // === 模拟实时弹幕 ===
  let interval: number | undefined;

  onMounted(() => {
    // 模拟实时弹幕数据
    const messages = ['欢迎来到直播间', '666', 'Vue 3 太强了', '加油！', '打call', '主播好棒'];
    const colors = ['#f60', '#0f0', '#0ff', '#f0f', '#ff0', '#fff'];

    // 定时发送模拟弹幕
    const sendRandomBarrage = () => {
      const text = messages[Math.floor(Math.random() * messages.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      addBarrage(text as string, { color, type: 'scroll' });
    };

    // 随机间隔发送弹幕
    interval = window.setInterval(sendRandomBarrage, Math.random() * 3000 + 1000);

    // 显示欢迎语
    addBarrage('🎉 欢迎使用高性能弹幕系统！', { color: '#ff0', type: 'top', fontSize: 20 });
  });

  onUnmounted(() => {
    // 清理定时器
    if (interval !== undefined) {
      clearInterval(interval);
    }
  });

  // 暴露添加弹幕方法供父组件调用
  defineExpose({ addBarrage });
</script>

<style scoped>
  .barrage-container {
    position: relative;
    width: 100%;
    height: 200px;
    /* overflow: hidden; */
    background: rgba(0, 0, 0, 0.7);
    border-radius: 12px;
    margin: 20px 0;
    user-select: none;
    border: 1px solid #333;
  }

  .barrage-item {
    position: absolute;
    white-space: nowrap;
    padding: 4px 12px;
    border-radius: 20px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
    pointer-events: none;
    z-index: 1;
  }

  .bullet-waiting {
    left: 100%;
  }

  .bullet-done {
    left: 0;
    transform: translateX(-100%);
  }

  @keyframes running {
    0% {
      left: 100%;
      transform: translate3d(0, 0, 0);
    }

    100% {
      left: 0;
      transform: translate3d(-100%, 0, 0);
    }
  }

  .bullet-running {
    animation: running 5s linear forwards;
  }

  /*
  .type-scroll {
    animation: barrageMove linear forwards;
    left: 100%;
    transform: translateY(-50%);
  }

  .type-top,
  .type-bottom {
    left: 50%;
    z-index: 10;
    font-weight: bold;
  }

  .type-top {
    animation: fadeInOut 3s ease-in-out;
  }

  .type-bottom {
    animation: fadeInOut 3s ease-in-out;
  }

  @keyframes barrageMove {
    0% {
      transform: translateY(-50%);
      opacity: 0;
    }

    10% {
      opacity: 1;
    }

    90% {
      opacity: 1;
    }

    100% {
      transform: translateX(calc(-100% - 100vw)) translateY(-50%);
      opacity: 0;
    }
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
    }

    20% {
      opacity: 1;
    }

    80% {
      opacity: 1;
    }

    100% {
      opacity: 0;
    }
  } */
</style>

<template>
  <a-layout class="layout-container">
    <a-layout-sider theme="light" width="200" class="left-sider">
      <div class="toolbar">
        <div class="toolbar-title">工具</div>
        <a-button block class="tool-btn" :type="currentTool === 'select' ? 'primary' : 'default'"
          @click="selectTool('select')">Select</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'circle' ? 'primary' : 'default'"
          @click="selectTool('circle')">Circle</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'rect' ? 'primary' : 'default'"
          @click="selectTool('rect')">Rect</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'triangle' ? 'primary' : 'default'"
          @click="selectTool('triangle')">Triangle</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'polygon' ? 'primary' : 'default'"
          @click="selectTool('polygon')">Polygon</a-button>
        <!-- <a-button block class="tool-btn" :type="currentTool === 'text' ? 'primary' : 'default'" @click="selectTool('text')">Text</a-button> -->
      </div>
    </a-layout-sider>
    <a-layout-content class="content-area">
      <div id="map-container"></div>
    </a-layout-content>
    <a-layout-sider theme="light" width="300" class="right-sider">
      <div class="right-panel-content">
        <a-card title="属性" size="small" :bordered="false">
          <a-empty v-if="selectionInfo.length === 0" description="未选中任何图形" :image="undefined" />
          <div v-else>
            <a-descriptions v-for="(item, idx) in selectionInfo" :key="idx" :title="item.tagName" size="small" :column="1" bordered style="margin-bottom: 16px">
              <a-descriptions-item label="宽度">{{ Math.round(item.width) }}</a-descriptions-item>
              <a-descriptions-item label="高度">{{ Math.round(item.height) }}</a-descriptions-item>
            </a-descriptions>
          </div>
        </a-card>

        <a-divider style="margin: 12px 0" />

        <a-card title="历史消息" size="small" :bordered="false" class="history-card" :bodyStyle="{ flex: 1, overflowY: 'auto', minHeight: 0 }">
          <a-empty v-if="historyLog.length === 0" description="暂无历史记录" :image="undefined" />
          <div v-else class="history-list">
            <a-card 
              v-for="(item, index) in historyLog" 
              :key="index" 
              size="small" 
              class="history-item-card" 
              :bordered="false"
              :bodyStyle="{ padding: '8px 12px' }"
            >
              <div class="history-content">
                <span class="history-index">#{{ index + 1 }}</span>
                <span class="history-desc">{{ item.desc || '未知操作' }}</span>
              </div>
            </a-card>
          </div>
        </a-card>
      </div>
    </a-layout-sider>
  </a-layout>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { BladeFire } from '../blade-fire/index.js'
import { history } from '../blade-fire/common/index.js'

const currentTool = ref('')
const selectionInfo = ref([])
const historyLog = ref([])
let activeToolCleanup = null
let selectionCleanup = null
let historyCleanup = null
let bladeFireCleanup = null

const selectTool = (tool) => {
  // If clicking the same tool, do nothing or toggle? 
  // For now, let's assume re-selecting resets the tool.

  // Cleanup previous tool
  if (activeToolCleanup) {
    activeToolCleanup()
    activeToolCleanup = null
  }

  currentTool.value = tool
  if (BladeFire[tool]) {
    const cleanup = BladeFire[tool]()
    if (typeof cleanup === 'function') {
      activeToolCleanup = cleanup
    }
  }
}

onMounted(() => {
  const instance = BladeFire.init({ container: 'map-container', grid: true, gridSize: 40, zoom: true })
  if (instance && instance.destroy) {
    bladeFireCleanup = instance.destroy
  }

  selectionCleanup = BladeFire.onSelectionChange((info) => {
    selectionInfo.value = info
  })

  historyCleanup = history.subscribe((stack) => {
    historyLog.value = [...stack]
  })
})

onUnmounted(() => {
  if (selectionCleanup) selectionCleanup()
  if (historyCleanup) historyCleanup()
  if (bladeFireCleanup) bladeFireCleanup()
})
</script>

<style scoped>
.layout-container {
  width: 100vw;
  height: 100vh;
  display: flex;
}

.left-sider {
  border-right: 1px solid #f0f0f0;
  z-index: 10;
}

.right-sider {
  border-left: 1px solid #f0f0f0;
  z-index: 10;
}

.content-area {
  position: relative;
  overflow: hidden;
  flex: 1;
}

#map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.toolbar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-title {
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 16px;
  color: #333;
}

.right-panel-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fff;
}

.history-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

.history-item-card {
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.3s;
}

.history-item-card:hover {
  background: #e6f7ff;
}

.history-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-index {
  color: #999;
  font-family: monospace;
  min-width: 24px;
}

.history-desc {
  font-weight: 500;
  color: #333;
}
</style>

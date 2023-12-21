<script>
/**
 * 微前端框架中的子应用容器
 * - Tab兜底逻辑：目标子应用页面中如果有了tab的DOM，则隐藏基座提供的tab；如果没有，则根据后台配置显示兜底tab
 * - 子应用容器的样式定制：指定容器以及页面加载中的loading效果，其height为100%
 */
</script>

<template>
  <div class="smp-base-micro-app-layout" :class="{ 'tab-wrapper': showTabs }">
    <div class="smp-base-micro-app-layout-header" v-if="showTabs">
      <div class="smp-base-micro-app-layout-header-tabs">
        <h2
          v-for="item in tabs"
          :key="item.id"
          class="smp-base-micro-app-layout-header-tab-title"
          :class="{ active: activeTabId === item.id }"
          @click="emitChangeTabEvent(item)"
        >
          {{ item.title }}
        </h2>
      </div>
    </div>
    <div class="smp-base-micro-app-layout-body" ref="microAppViewport">
      <a-spin id="subapp-viewport" :spinning="false" size="large">
        <router-view />
      </a-spin>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations, mapState } from 'vuex';

export default {
  data() {
    return {
      hasDtHeaderWithTabs: false, // 默认没有带有tabs的dt-header
    };
  },
  computed: {
    ...mapState({
      appLifeCycle: (state) => state.app.lifeCycle,
      currentApp: (state) => state.app.currentApp,
      prevApp: (state) => state.app.prevApp,
    }),
    ...mapGetters([
      'appBaseLoading',
      'activeTabId',
      'tabs',
      'showWxWorkConfig',
    ]),
    showTabs() {
      if (!this.tabs.length) {
        return false;
      }

      // 应用被卸载了，不显示tabs
      if (this.appLifeCycle !== 'mounted') {
        return false;
      }

      // 如果切换应用，则loading时，不展示tab
      if (this.prevApp !== this.currentApp) {
        if (
          this.appBaseLoading.appLoading ||
          this.appBaseLoading.appPageLoading
        ) {
          return false;
        }
      }

      // 如果发现带有tabs标记的header，不展示tabs
      if (this.hasDtHeaderWithTabs) {
        return false;
      }

      // 如果展示了企微拦截，不展示tabs
      if (this.showWxWorkConfig) {
        return false;
      }

      return true;
    },
  },
  watch: {
    // 如果生命周期发生变化，则注册监听器重新刷新tabs状态
    appLifeCycle(val) {
      if (val === 'mounted' && this.tabs.length) {
        this.listenDtHeaderDomChange();
      }
    },
    tabs: {
      handler(val) {
        this.hasDtHeaderWithTabs = false;
        // 如果tabs为空，则取消监听; 否则，开始监听
        if (val?.length) {
          this.listenDtHeaderDomChange();
        } else {
          this.cancelDtHeaderDomListener();
        }
      },
      deep: true,
      immediate: true,
    },
  },
  unmounted() {
    this.cancelDtHeaderDomListener();
  },
  methods: {
    ...mapMutations({
      changeTab: 'menu/changeTab',
    }),
    listenDtHeaderDomChange(autoTrigger = true) {
      if (!this.mutationObserver) {
        this.mutationObserver = new MutationObserver(() => {
          this.refreshHasDtHeaderWithTabs();
        });
        this.mutationObserver.observe(this.$refs.microAppViewport, {
          childList: true,
          subtree: true,
        });
      }

      // 兜底逻辑：定时30s，超时就不再监听dom变化
      clearTimeout(this.listenDtHeaderDomChangeTimeout);
      this.listenDtHeaderDomChangeTimeout = setTimeout(() => {
        this.cancelDtHeaderDomListener();
      }, 30000);

      if (autoTrigger) {
        this.refreshHasDtHeaderWithTabs();
      }
    },
    cancelDtHeaderDomListener() {
      if (this.mutationObserver) {
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
      }
    },
    refreshHasDtHeaderWithTabs() {
      // 在页面已加载完成的情况下，查询子应用页面上是否有带有tab标记的dt-header，如果有，则依然不显示tab
      this.hasDtHeaderWithTabs = !!this.$refs.microAppViewport.querySelector(
        '.dt-header[data-tabs], .dt-page-header[data-tabs]',
      );
    },
    emitChangeTabEvent(tabItem) {
      this.changeTab(tabItem);
    },
  },
};
</scripte>

<style lang="less" scoped>
.smp-base-micro-app-layout {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  &-header {
    min-height: 64px;
    padding: 0 24px 0 8px;
    background: #fff;
    border-radius: 2px;
    margin: 16px 24px;
    flex-shrink: 0;
    box-sizing: border-box;
    &-tabs {
      display: flex;
      height: 100%;
    }
    &-tab-title {
      position: relative;
      margin: 0;
      display: flex;
      align-items: center;
      color: rgba(0, 0, 0, 0.45);
      font-weight: 400;
      font-size: 16px;
      height: 100%;
      cursor: pointer;
      transition: all 0.22s;
      user-select: none;
      padding: 4px 16px;
      &.active,
      &:hover {
        color: var(--main-color);
      }
      &.active {
        font-weight: 500;
        &::after {
          display: block;
        }
      }
      &::after {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        display: none;
        width: 25%;
        height: 3px;
        border-radius: 2px;
        background: var(--main-color);
        content: "";
      }
    }
    .smp-base-space-item {
      &:last-of-type {
        h2::after {
          display: none;
        }
      }
    }
  }
  &-body {
    flex-grow: 1;
  }
}

// 控制微应用容器高度
// qiankun根容器、SCRM根容器、CDP根容器
/deep/ #subapp-viewport {
  height: 100%;
  > div,
  #dashboard,
  #app {
    height: calc(100vh - 64px);
  }
}

.tab-wrapper {
  /deep/ #subapp-viewport {
    > div,
    #dashboard,
    #app {
      // tab高度为96px，顶部导航高度为64px
      height: calc(100vh - 160px);
    }
  }
}

/deep/ .smp-base-spin-nested-loading {
  height: 100%;
}
/deep/ .smp-base-spin-container {
  height: 100%;
}
</style>

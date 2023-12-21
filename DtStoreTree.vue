<script>
/**
 * 门店选择器
 * - 使用了三方的虚拟树组件，用于支持大量门店节点的渲染
 * - 支持外部业务使用时，对门店节点进行自定义渲染
 * - 由于门店数据很大，做了vuex数据缓存，具体的树数据请求与基础处理都在vuex中实现
 */
</script>

<template>
  <div class="store-tree-container" :class="{ compact }" ref="container">
    <a-spin :spinning="initLoading">
      <vue-easy-tree
        ref="tree"
        node-key="key"
        empty-text="暂无数据"
        :check-strictly="!checkLink"
        :show-checkbox="selectable && multiple"
        :check-on-click-node="false"
        :height="treeHeight + 'px'"
        :data="treeData"
        auto-expand-parent
        highlight-current
        :expand-on-click-node="expandOnClickNode"
        :default-expanded-keys="defaultExpandedKeys"
        :filter-node-method="filterNode"
        icon-class="el-icon-arrow-right"
        @check="onCheck"
        @node-click="onNodeClick"
        @node-expand="onNodeExpand"
        @node-collapse="onNodeCollapse"
        @current-change="onCurrentChange"
      >
        <!-- 自定义节点 -->
        <div
          class="custom-tree-node"
          slot-scope="{ node, data }"
          :class="{ isRoot: data.isRoot }"
        >
          <div class="tree-node-info">
            <smp-icon
              class="node-icon large"
              v-if="data.type === StoreTreeNodeType.enterprise"
              :type="StoreTreeNodeIcon[StoreTreeNodeType.enterprise]"
            />
            <template v-if="!hideIcon">
              <smp-icon
                class="node-icon"
                v-if="data.type === StoreTreeNodeType.organization"
                :type="StoreTreeNodeIcon[StoreTreeNodeType.organization]"
              />
              <smp-icon
                class="node-icon"
                v-if="data.type === StoreTreeNodeType.store"
                :type="StoreTreeNodeIcon[StoreTreeNodeType.store]"
              />
            </template>
            <dt-text-more
              v-if="!searchMode"
              class="node-title"
              :class="{ strong: data.type === StoreTreeNodeType.enterprise }"
              :text="data.title"
              :get-tip-container="getTooltipContainer"
            />
            <a-tooltip
              v-else
              overlay-class-name="tooltipWhite"
              :get-popup-container="getTooltipContainer"
            >
              <span slot="title">{{ data.nodeChainText }}</span>
              <span class="search-chain-tip">{{ data.title }}</span>
            </a-tooltip>
          </div>
          <div class="action">
            <!-- @slot 节点操作区域，自动隐藏 -->
            <slot name="action" :node="node" :data="data"></slot>
          </div>
          <div class="extra">
            <!-- @slot 节点后缀区域 -->
            <slot name="extra" :node="node" :data="data"></slot>
          </div>
        </div>
      </vue-easy-tree>
    </a-spin>
  </div>
</template>

<script>
import {
  SelectStoreMode,
  StoreTreeNodeIcon,
  StoreTreeNodeType,
} from '@/common/constants/store';
import cloneDeep from 'lodash/cloneDeep';

/**
 * 门店组织树
 * @displayName 门店组织树 / dt-store-tree
 * @since version 0.2.1
 * @author 翁鹏辉
 */
export default {
  name: 'dt-store-tree',
  props: {
    /**
     * 显示模式
     * @values organization, store 组织、门店
     */
    mode: {
      type: String,
      default: 'organization',
    },
    /**
     * 是否展示已删除门店
     */
    showDeletedStore: {
      type: Boolean,
      default: false,
    },
    /**
     * 视图ID
     */
    storeViewId: {
      type: [Number, String],
    },
    /**
     * 可选
     */
    selectable: {
      type: Boolean,
      default: false,
    },
    /**
     * 多选
     */
    multiple: {
      type: Boolean,
      default: true,
    },
    /**
     * 隐藏图标，不影响企业图标
     */
    hideIcon: {
      type: Boolean,
      default: false,
    },
    /**
     * 紧凑模式，缩进做一定的优化
     */
    compact: {
      type: Boolean,
      default: false,
    },
    /**
     * 点击节点就展开
     */
    expandOnClickNode: {
      type: Boolean,
      default: false,
    },
    /**
     * 自动选中企业，选中后触发node-click事件
     */
    autoSetEnterprise: {
      type: Boolean,
      default: false,
    },
    /**
     * 勾选状态，父子关联
     */
    checkLink: {
      type: Boolean,
      default: true,
    },
    /**
     * 禁用节点的ids，仅selectable为true有效
     */
    disabledKeys: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      StoreTreeNodeType,
      StoreTreeNodeIcon,

      treeHeight: 500,

      allTreeData: [],

      defaultExpandedKeys: [],
      expandedKeys: new Set(),

      currentKey: null,

      searchMode: false,
      searchResult: [],
      initLoading: false,
    };
  },
  computed: {
    treeData() {
      if (this.searchMode) {
        return this.searchResult;
      } else {
        return this.allTreeData;
      }
    },
    showStore() {
      return this.mode === 'store';
    },
  },
  watch: {
    disabledKeys: {
      handler() {
        this.refreshNodeDisabledStatus(this.allTreeData);
      },
      immediate: true,
    },
  },
  async created() {
    await this.refreshTreeData();
    this.selectDefaultNode();
  },
  destroyed() {
    // 如果有数据视图数据，则销毁时自动清理
    const storeViewId = this.storeViewId;
    if (storeViewId) {
      this.$store.commit('smpUIStore/clearStoreViewIdData', { storeViewId });
    }
  },
  mounted() {
    this.init();
  },
  methods: {
    init() {
      this.refreshHeight();
    },
    /**
     * 刷新树高度
     *
     * @public
     */
    refreshHeight() {
      this.treeHeight = this.$refs.container?.offsetHeight || 500;
    },
    async refreshTreeData() {
      try {
        this.initLoading = true;
        await this.$store.dispatch('smpUIStore/initTreeData', {
          storeViewId: this.storeViewId,
        });

        const storeData = this.$store.getters['smpUIStore/getStoreData'](
          this.storeViewId,
        );

        const storeTree = this.preProcessTreeData(storeData);

        // 给每个树节点，初始化disabled属性
        this.refreshNodeDisabledStatus(storeTree);

        this.allTreeData = storeTree;

        await this.$nextTick();
        // 保持树的浏览状态
        // 1. 回显展开项
        // 2. 回显选中项
        if (this.expandedKeys.size) {
          this.defaultExpandedKeys = Array.from(this.expandedKeys);
        }

        if (this.currentKey) {
          this.setCurrentKey(this.currentKey);
        }

        /**
         * 刷新结束
         */
        this.$emit('refresh-end');
      } catch (error) {
        console.log(
          '🚀 ~ file: DtStoreTree.vue:223 ~ refreshTreeData ~ error',
          error,
        );
      } finally {
        this.initLoading = false;
      }
    },
    preProcessTreeData(storeData) {
      let storeTree = [];

      // 不显示门店，则去除门店节点
      if (this.showStore) {
        storeTree = storeData?.storeTree || [];
      } else {
        storeTree = storeData?.storeTreeExcludeStore || [];
      }

      // 紧凑模式，从企业开始的树，其根节点，处理为和其他部门平级
      if (this.compact) {
        if (storeTree.length === 1) {
          const rootStoreNode = storeTree[0];

          if (rootStoreNode.type === StoreTreeNodeType.enterprise) {
            const newRootStoreNode = { ...rootStoreNode };
            newRootStoreNode.isRoot = true;
            const newRootStoreNodeChildren = newRootStoreNode.children || [];
            delete newRootStoreNode.children;
            storeTree = [newRootStoreNode, ...newRootStoreNodeChildren];
          }
        }
      }

      return cloneDeep(storeTree);
    },
    async selectDefaultNode() {
      if (!this.treeData.length) {
        return;
      }

      const defaultNode = this.treeData[0];
      const defaultKey = defaultNode.key;
      this.defaultExpandedKeys = [defaultKey];
      this.expandedKeys = new Set([defaultKey]);

      // 默认点中企业
      if (
        this.autoSetEnterprise &&
        defaultNode.type === StoreTreeNodeType.enterprise
      ) {
        await this.$nextTick();
        this.setCurrentKey(defaultKey);
        await this.$nextTick();

        const currentNode = this.getCurrentNode();
        if (currentNode) {
          this.$emit('node-click', currentNode);
        }
      }
    },
    // 递归处理树节点，直接改变
    processTreeNode(nodeList, processor) {
      nodeList.forEach((node) => {
        processor(node);

        if (node.children) {
          this.processTreeNode(node.children, processor);
        }
      });
    },
    // 根据disableKeys数组，刷新树节点的disabled状态
    refreshNodeDisabledStatus(targetTreeData) {
      if (this.selectable) {
        this.processTreeNode(
          targetTreeData,
          (node) => (node.disabled = this.disabledKeys.includes(node.key)),
        );
      }
    },
    filterNode(value, data) {
      if (!this.showStore) {
        if (data.type === StoreTreeNodeType.store) {
          return true;
        }
      }
      if (!value) return true;
      return data.isLeaf && data.title.trim().toLowerCase().includes(value);
    },
    // 多选
    onCheck(data, checkedInfo) {
      if (this.selectable && this.multiple) {
        console.log(checkedInfo);
        const checked = checkedInfo.checkedKeys.includes(data.key);
        /**
         * checkbox被选中
         */
        this.$emit('node-check', data, checked);
      }
    },
    onNodeClick(data) {
      this.$emit('node-click', data);
    },
    onNodeExpand(data) {
      this.expandedKeys.add(data.key);
    },
    onNodeCollapse(data) {
      this.expandedKeys.delete(data.key);
    },
    onCurrentChange(data) {
      // 搜索模式下，不记录
      if (this.searchMode) {
        return;
      }
      this.currentKey = data.key;
    },
    /**
     * 获取VueEasyTree的ref
     * @public
     */
    getVTreeRef() {
      return this.$refs.tree;
    },
    /**
     * 设置当前选中的节点
     * @param {String} key 节点的key字段
     * @public
     */
    setCurrentKey(key) {
      this.$refs.tree.setCurrentKey(key);
    },
    getCurrentNode() {
      return this.$refs.tree.getCurrentNode();
    },
    /**
     * 设置当前已勾选的节点
     * @param {Array<String>} keys 数组<节点的key字段>
     * @param {Boolean} leafOnly 是否仅勾选叶子节点，默认为false
     * @public
     */
    setCheckedKeys(keys, leafOnly) {
      this.$refs.tree.setCheckedKeys(keys, leafOnly);
    },
    /**
     * 设置某个节点是否选中
     * @param key 节点key
     * @param checked 是否选中
     */
    setChecked(key, checked) {
      this.$refs.tree.setChecked(key, checked);
    },
    /**
     * 刷新树
     *
     * @param {Boolean} force 重置选中、展开等状态
     * @public
     */
    refresh(force = false) {
      this.refreshTreeData();

      if (force) {
        this.setCurrentKey(null);
        this.selectDefaultNode();
      }
    },
    /**
     * 跳转节点
     *
     * @param {number} id 节点id
     * @public
     */
    jumpToNode(id) {
      console.log(this.$refs.tree);
      this.defaultExpandedKeys.push(id);

      this.$nextTick(() => {
        const scroller = this.$refs.tree._vnode.children.find((item) =>
          item.tag?.match(/scroller/i),
        );

        if (scroller) {
          // todo: 需要计算id所在的index
          const treeItems = [...this.$refs.tree.treeItems];
          const nodeIndex = treeItems.findIndex((item) => item.id === id);
          console.log(nodeIndex);
          if (nodeIndex > -1) {
            scroller.componentInstance.scrollToItem(nodeIndex);
          }
        }
      });
    },
    /**
     * 搜索
     */
    async search(keywords) {
      if (!keywords) {
        this.searchMode = false;
        this.searchResult = [];
        this.$nextTick(() => {
          // 还原选中态
          this.setCurrentKey(this.currentKey);
        });
        return;
      }

      const result = await this.$store.dispatch('smpUIStore/search', {
        keyword: keywords,
        mode:
          this.mode === 'organization'
            ? SelectStoreMode.organization
            : SelectStoreMode.organizationStore,
        storeViewId: this.storeViewId,
      });

      this.searchMode = true;
      this.searchResult = result;
    },
    getScrollerWrapperEle() {
      if (!this.scrollerWrapperEle) {
        this.scrollerWrapperEle = this.$refs.container.querySelector(
          '.vue-recycle-scroller__item-wrapper',
        );
      }

      return this.scrollerWrapperEle;
    },
    getTooltipContainer() {
      return this.getScrollerWrapperEle();
    },
  },
};
</script>

<style lang="less" scoped>
.store-tree-container {
  position: relative;
  width: 100%;
  height: 100%;

  // 紧凑模式下，企业根节点缩进减少
  &.compact {
    .custom-tree-node {
      &.isRoot {
        margin-left: -16px;
        z-index: 1;
      }
    }
  }
}

.custom-tree-node {
  overflow: hidden;
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  line-height: 1;
  padding-right: 8px;

  .tree-node-info {
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .node-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-right: 8px;

    &.large {
      font-size: 20px;
    }
  }

  .action {
    display: none;
    flex-shrink: 0;
    margin-left: 12px;
  }

  .extra {
    flex-shrink: 0;
    &:empty {
      display: none;
    }
  }

  .node-title {
    font-size: 14px;
    font-weight: 400;
    color: #595959;
    &.strong {
      font-weight: 500;
      color: #262626;
    }
  }
}

/deep/ .el-tree--highlight-current {
  .el-tree-node {
    &.is-current > .el-tree-node__content {
      background-color: rgba(36, 116, 255, 0.04);
    }
  }
}

/deep/ .el-tree-node {
  > .el-tree-node__content {
    transition: background-color 0.3s;
  }

  &:focus > .el-tree-node__content {
    background-color: transparent;
  }

  &:hover > .el-tree-node__content {
    background-color: #f0f0f0;
  }

  .el-tree-node__content {
    padding-left: 6px;
  }

  &.is-drop-inner {
    background: grey;
  }

  &:hover {
    .action {
      &:not(:empty) {
        display: block;
      }
    }
  }

  // 展开朝上，收起朝下
  .el-tree-node__expand-icon {
    &:not(.is-leaf) {
      color: #595959;
      font-weight: bold;
    }
  }
}

.search-chain-tip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
}
</style>

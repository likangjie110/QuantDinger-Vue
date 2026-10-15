<template>
  <div class="job-list">
    <div class="fm-toolbar">
      <a-button icon="reload" :loading="loading" @click="loadJobs">
        {{ $t('common.refresh') }}
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="jobs"
      :loading="loading"
      :pagination="false"
      :row-key="record => record.jobId"
      size="middle"
    >
      <template slot="status" slot-scope="text">
        <a-tag :color="statusColor(text)">{{ statusLabel(text) }}</a-tag>
      </template>

      <template slot="window" slot-scope="text, record">
        <span v-if="record.config && record.config.startDate">
          {{ record.config.startDate }} ~ {{ record.config.endDate }}
        </span>
        <span v-else>-</span>
      </template>

      <template slot="progress" slot-scope="text, record">
        <div v-if="isActive(record.status)">
          <a-progress :percent="percentOf(record)" size="small" status="active" />
          <span class="fm-sub">{{ progressText(record) }}</span>
        </div>
        <span v-else-if="record.hasResult">
          {{ $t('factorMining.jobs.seeDetail') }}
        </span>
        <span v-else>-</span>
      </template>

      <template slot="createdAt" slot-scope="text">
        {{ formatTime(text) }}
      </template>

      <template slot="action" slot-scope="text, record">
        <a-space>
          <a @click="openDetail(record)">{{ $t('factorMining.actions.view') }}</a>
          <a-popconfirm
            v-if="isActive(record.status)"
            :title="$t('factorMining.jobs.confirmCancel')"
            @confirm="handleCancel(record.jobId)"
          >
            <a class="fm-danger">{{ $t('common.cancel') }}</a>
          </a-popconfirm>
        </a-space>
      </template>
    </a-table>

    <a-empty v-if="!loading && !jobs.length" :description="$t('factorMining.jobs.empty')" />

    <a-modal
      v-model="detailVisible"
      :title="$t('factorMining.jobs.detail')"
      :width="860"
      :footer="null"
    >
      <div v-if="detail">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item :label="$t('factorMining.jobs.jobId')">
            {{ detail.jobId }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.status')">
            <a-tag :color="statusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.market')">
            {{ detail.config.market || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.timeframe')">
            {{ detail.config.timeframe || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.window')" :span="2">
            {{ detail.config.startDate }} ~ {{ detail.config.endDate }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.budget')">
            {{ detail.config.budget }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.submit.seed')">
            {{ detail.config.seed }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.createdAt')">
            {{ formatTime(detail.createdAt) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.finishedAt')">
            {{ formatTime(detail.finishedAt) }}
          </a-descriptions-item>
        </a-descriptions>

        <template v-if="detail.result && detail.result.summary">
          <a-divider>{{ $t('factorMining.jobs.result') }}</a-divider>
          <a-descriptions :column="3" bordered size="small">
            <a-descriptions-item :label="$t('factorMining.jobs.trials')">
              {{ detail.result.summary.trials }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.jobs.candidates')">
              {{ detail.result.summary.candidates }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.jobs.frozen')">
              {{ detail.result.summary.frozen }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.jobs.snapshotId')" :span="3">
              <span class="fm-mono">{{ detail.result.summary.snapshotId }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.jobs.searchWindow')" :span="3">
              {{ windowText(detail.result.split, 'searchStart', 'searchEnd') }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.jobs.frozenWindow')" :span="3">
              {{ windowText(detail.result.split, 'freezeStart', 'freezeEnd') }}
            </a-descriptions-item>
          </a-descriptions>
        </template>

        <a-alert
          v-if="detail.error"
          type="error"
          show-icon
          style="margin-top: 16px"
          :message="errorHeadline(detail.error)"
        >
          <template slot="description">
            <pre class="fm-trace">{{ detail.error }}</pre>
          </template>
        </a-alert>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { getJobs, getJobDetail, cancelJob } from '@/api/factor-mining'
import moment from 'moment'

// Only a job the runner can still act on is worth polling or cancelling.
const ACTIVE = ['queued', 'running']
const POLL_MS = 5000

export default {
  name: 'JobList',
  data () {
    return {
      jobs: [],
      loading: false,
      detail: null,
      detailVisible: false,
      timer: null
    }
  },
  computed: {
    columns () {
      return [
        { title: this.$t('factorMining.jobs.jobId'), dataIndex: 'jobId', width: 300 },
        {
          title: this.$t('factorMining.jobs.status'),
          dataIndex: 'status',
          width: 110,
          scopedSlots: { customRender: 'status' }
        },
        {
          title: this.$t('factorMining.jobs.market'),
          width: 110,
          customRender: (text, record) => (record.config && record.config.market) || '-'
        },
        {
          title: this.$t('factorMining.jobs.window'),
          width: 200,
          scopedSlots: { customRender: 'window' }
        },
        {
          title: this.$t('factorMining.jobs.budget'),
          width: 90,
          customRender: (text, record) => (record.config ? record.config.budget : '-')
        },
        {
          title: this.$t('factorMining.jobs.progress'),
          width: 180,
          scopedSlots: { customRender: 'progress' }
        },
        {
          title: this.$t('factorMining.jobs.createdAt'),
          dataIndex: 'createdAt',
          width: 170,
          scopedSlots: { customRender: 'createdAt' }
        },
        { title: this.$t('common.actions'), width: 140, scopedSlots: { customRender: 'action' } }
      ]
    }
  },
  mounted () {
    this.loadJobs()
    this.timer = setInterval(() => {
      if (this.jobs.some(job => ACTIVE.includes(job.status))) this.loadJobs()
    }, POLL_MS)
  },
  beforeDestroy () {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    isActive (status) {
      return ACTIVE.includes(status)
    },
    statusLabel (status) {
      const key = `factorMining.jobStatus.${status}`
      const text = this.$t(key)
      return text === key ? status : text
    },
    statusColor (status) {
      return {
        queued: 'default',
        running: 'processing',
        succeeded: 'success',
        failed: 'error',
        cancelled: 'warning'
      }[status] || 'default'
    },
    message (key) {
      const text = this.$t(key)
      return text === key ? key : text
    },
    errorHeadline (error) {
      // The job store persists `str(exception)`, so a failed run reads as the i18n key the
      // service raised followed by a full traceback -- not as a bare key. Translate the leading
      // token when the bundle knows it, and leave the verbatim text to the description: it is
      // what a developer needs, and it is the one thing here a reader cannot reconstruct.
      const raw = String(error || '').trim()
      const head = raw.split(/\s+/)[0] || ''
      const text = this.$t(head)
      return text === head ? raw.split('\n')[0] : text
    },
    percentOf (record) {
      const progress = record.progress || {}
      const total = Number(progress.total)
      if (!total) return 0
      return Math.min(100, Math.floor((Number(progress.evaluated) || 0) / total * 100))
    },
    progressText (record) {
      const progress = record.progress || {}
      if (!progress.total) return this.$t('factorMining.jobs.waiting')
      const stage = progress.stage === 'review'
        ? this.$t('factorMining.jobs.stageReview')
        : this.$t('factorMining.jobs.stageSearch')
      return `${stage} ${progress.evaluated} / ${progress.total}`
    },
    windowText (split, from, to) {
      if (!split) return '-'
      return `${split[from] || '-'} ~ ${split[to] || '-'}`
    },
    formatTime (value) {
      return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    async loadJobs () {
      this.loading = true
      try {
        const res = await getJobs({ limit: 50 })
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.jobs = res.data.items || []
      } catch (error) {
        this.$message.error(this.$t('factorMining.jobs.loadFailed'))
      } finally {
        this.loading = false
      }
    },
    async openDetail (record) {
      try {
        const res = await getJobDetail(record.jobId)
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.detail = res.data
        this.detailVisible = true
      } catch (error) {
        this.$message.error(this.$t('factorMining.jobs.loadFailed'))
      }
    },
    async handleCancel (jobId) {
      try {
        const res = await cancelJob(jobId)
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.$message.success(this.$t('factorMining.jobs.cancelSuccess'))
        this.loadJobs()
      } catch (error) {
        this.$message.error(this.$t('factorMining.jobs.cancelFailed'))
      }
    }
  }
}
</script>

<style lang="less" scoped>
.fm-toolbar {
  margin-bottom: 16px;
  text-align: right;
}

.fm-sub {
  display: block;
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.fm-danger {
  color: #ff4d4f;
}

.fm-mono {
  font-family: monospace;
  word-break: break-all;
}

.fm-trace {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

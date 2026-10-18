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
      :width="'min(860px, calc(100vw - 32px))'"
      :footer="null"
    >
      <div v-if="detailLoading" class="fm-detail-state">
        <a-spin />
      </div>

      <a-alert v-else-if="detailError" type="error" show-icon :message="detailError">
        <template slot="description">
          <a-button size="small" @click="loadDetail(currentJobId)">
            {{ $t('factorMining.proposals.retry') }}
          </a-button>
        </template>
      </a-alert>

      <div v-else-if="detail">
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

        <template v-if="aiSummary">
          <a-divider>{{ $t('factorMining.ai.summary') }}</a-divider>
          <a-descriptions :column="3" bordered size="small">
            <a-descriptions-item :label="$t('factorMining.ai.rounds')">
              {{ aiSummary.rounds }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.ai.proposals')">
              {{ aiSummary.proposals }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.ai.l1Rejected')">
              {{ aiSummary.l1Rejected }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.ai.duplicates')">
              {{ aiSummary.duplicates }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.ai.evaluated')">
              {{ aiSummary.evaluated }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.ai.model')">
              {{ modelText }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="aiSummary.replayOf"
              :label="$t('factorMining.ai.replayOf')"
              :span="2"
            >
              <span class="fm-mono">{{ aiSummary.replayOf }}</span>
            </a-descriptions-item>
            <a-descriptions-item
              v-if="aiSummary.replayOf"
              :label="$t('factorMining.ai.snapshotChanged')"
            >
              <a-tag :color="aiSummary.snapshotChanged ? 'warning' : 'default'">
                {{ aiSummary.snapshotChanged ? $t('common.yes') : $t('common.no') }}
              </a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </template>

        <a-alert
          v-if="detail.error"
          type="error"
          show-icon
          style="margin-top: 16px"
          :message="message(detail.error)"
        />

        <template v-if="isAiJob">
          <a-divider>{{ $t('factorMining.proposals.title') }}</a-divider>
          <div v-if="proposalsLoading" class="fm-detail-state">
            <a-spin />
          </div>
          <a-alert
            v-else-if="proposalsError"
            type="error"
            show-icon
            :message="proposalsError"
          >
            <template slot="description">
              <a-button size="small" @click="loadProposals(detail.jobId)">
                {{ $t('factorMining.proposals.retry') }}
              </a-button>
            </template>
          </a-alert>
          <a-empty v-else-if="!proposals.length" :description="$t('factorMining.proposals.empty')" />
          <a-table
            v-else
            :columns="proposalColumns"
            :data-source="proposals"
            :pagination="false"
            :row-key="record => record.id"
            :scroll="{ x: 720 }"
            size="small"
          >
            <template slot="proposalStatus" slot-scope="text">
              <a-tag :color="proposalStatusColor(text)">{{ proposalStatusLabel(text) }}</a-tag>
            </template>

            <template slot="proposalReason" slot-scope="text">
              {{ reasonText(text) }}
            </template>
          </a-table>
        </template>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { getJobs, getJobDetail, cancelJob, getJobProposals } from '@/api/factor-mining'
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
      detailLoading: false,
      detailError: '',
      currentJobId: '',
      proposals: [],
      proposalsLoading: false,
      proposalsError: '',
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
    },
    aiSummary () {
      const result = this.detail && this.detail.result
      return (result && result.summary && result.summary.ai) || null
    },
    // Proposals belong to AI runs only; `config.searchMode` also answers while the job is still
    // running and the result -- and with it the AI summary -- does not exist yet.
    isAiJob () {
      if (this.aiSummary) return true
      const config = this.detail && this.detail.config
      return Boolean(config && config.searchMode === 'ai')
    },
    modelText () {
      const ai = this.aiSummary || {}
      return [ai.provider, ai.model].filter(Boolean).join(' / ') || '-'
    },
    proposalColumns () {
      return [
        { title: this.$t('factorMining.proposals.round'), dataIndex: 'round', width: 80 },
        { title: this.$t('factorMining.proposals.ordinal'), dataIndex: 'ordinal', width: 90 },
        {
          title: this.$t('factorMining.proposals.hypothesis'),
          dataIndex: 'hypothesis',
          width: 320,
          customRender: text => text || '-'
        },
        {
          title: this.$t('factorMining.proposals.status'),
          dataIndex: 'status',
          width: 130,
          scopedSlots: { customRender: 'proposalStatus' }
        },
        {
          title: this.$t('factorMining.proposals.reason'),
          dataIndex: 'reason',
          width: 220,
          scopedSlots: { customRender: 'proposalReason' }
        }
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
    failureMessage (error, fallback) {
      const envelope = error && error.response && error.response.data
      const key = envelope && envelope.msg
      return key ? this.message(key) : this.$t(fallback)
    },
    proposalStatusLabel (status) {
      const suffix = status === 'l1_rejected' ? 'l1Rejected' : status
      const key = `factorMining.proposalStatus.${suffix}`
      const text = this.$t(key)
      return text === key ? status : text
    },
    proposalStatusColor (status) {
      return {
        proposed: 'blue',
        evaluated: 'success',
        l1_rejected: 'error',
        duplicate: 'warning'
      }[status] || 'default'
    },
    // A rejection reason is a backend key, sometimes parameterised (`...invalid:<detail>`); the
    // prefix is the documented, translatable part.
    reasonText (reason) {
      if (!reason) return '-'
      return this.message(String(reason).split(':')[0])
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
    openDetail (record) {
      this.detailVisible = true
      this.detail = null
      this.proposals = []
      this.proposalsError = ''
      this.loadDetail(record.jobId)
    },
    async loadDetail (jobId) {
      if (!jobId) return
      this.currentJobId = jobId
      this.detailLoading = true
      this.detailError = ''
      try {
        const res = await getJobDetail(jobId)
        if (res.code !== 1) {
          this.detailError = this.message(res.msg)
          return
        }
        this.detail = res.data
        if (this.isAiJob) this.loadProposals(jobId)
      } catch (error) {
        // The backend answers a missing job and another tenant's job with the same 404 key, so
        // rendering its message keeps the two indistinguishable.
        this.detailError = this.failureMessage(error, 'factorMining.jobs.loadFailed')
      } finally {
        this.detailLoading = false
      }
    },
    async loadProposals (jobId) {
      this.proposalsLoading = true
      this.proposalsError = ''
      try {
        const res = await getJobProposals(jobId)
        if (res.code !== 1) {
          this.proposalsError = this.message(res.msg)
          return
        }
        this.proposals = (res.data && res.data.items) || []
      } catch (error) {
        this.proposalsError = this.$t('factorMining.proposals.failed')
      } finally {
        this.proposalsLoading = false
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

.fm-detail-state {
  padding: 32px 0;
  text-align: center;
}
</style>

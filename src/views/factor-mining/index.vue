<template>
  <div class="factor-mining qd-workspace-page qd-page-frame" :class="{ 'theme-dark': isDarkTheme }">
    <header class="fm-header">
      <div>
        <h1>{{ $t('factorMining.title') }}</h1>
        <p>{{ $t('factorMining.subtitle') }}</p>
      </div>
    </header>

    <div class="fm-content">
      <a-tabs v-model="activeTab">
        <a-tab-pane key="submit" :tab="$t('factorMining.tabs.submit')">
          <submit-job @submitted="onSubmitted" />
        </a-tab-pane>
        <a-tab-pane key="jobs" :tab="$t('factorMining.tabs.jobs')">
          <job-list ref="jobs" />
        </a-tab-pane>
        <a-tab-pane key="candidates" :tab="$t('factorMining.tabs.candidates')">
          <candidate-list />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import SubmitJob from './components/SubmitJob.vue'
import JobList from './components/JobList.vue'
import CandidateList from './components/CandidateList.vue'

export default {
  name: 'FactorMining',
  components: { SubmitJob, JobList, CandidateList },
  data () {
    return {
      activeTab: 'submit'
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () {
      return this.navTheme === 'dark' || this.navTheme === 'realdark'
    }
  },
  methods: {
    // A receipt is not a result: the job was only queued, so the useful next screen is the one
    // that will show it move. The list loads on its own mount, which is why this switches first.
    onSubmitted () {
      this.activeTab = 'jobs'
      this.$nextTick(() => {
        const jobs = this.$refs.jobs
        if (jobs && jobs.loadJobs) jobs.loadJobs()
      })
    }
  }
}
</script>

<style lang="less" scoped>
.factor-mining {
  padding: 24px;
}

.fm-header {
  margin-bottom: 24px;

  h1 {
    margin-bottom: 8px;
    font-size: 22px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: rgba(0, 0, 0, 0.45);
  }
}

.fm-content {
  background: #fff;
  border-radius: 4px;
  padding: 24px;
}

.theme-dark {
  .fm-header {
    h1 {
      color: rgba(255, 255, 255, 0.85);
    }

    p {
      color: rgba(255, 255, 255, 0.45);
    }
  }

  .fm-content {
    background: #1f1f1f;
  }
}
</style>

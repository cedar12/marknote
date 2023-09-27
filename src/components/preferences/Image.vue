<template>
  <div class="preferences-image">
    <div class="preferences-item">
      <div class="header">
        <span>{{ t('saveImageType') }}</span>
      </div>
      <div class="content">
        <ElSelect v-model="saveType" @change="onChange" :key="locale">
          <ElOption v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></ElOption>
        </ElSelect>
        <span class="content-tip">
          默认: 相对Markdown文档路径存储插入的图片<br/>
          指定: 系统绝对路径存储插入的图片<br/>
          PicGo: 插入的图片上传至PicGo图床
        </span>
      </div>

    </div>
    <div class="preferences-item" v-if="saveType!=='picgo'">
      <div class="header">
        <span>{{ t('saveImagePath') }}</span>
      </div>
      <div class="content">
        <ElInput v-model="path" @change="onChangePath"></ElInput>
        <span class="content-tip" v-if="saveType==='default'">
          Includes ${filename} in the text-box above to automatically insert the document filename.
        </span>
      </div>
    </div>
    <div class="preferences-item" v-else>
      <div class="header">
        <span>{{ t('saveImagePath') }}</span>
      </div>
      <div class="content">
        <ElInput v-model="path" @change="onChangePath"></ElInput>
      </div>
    </div>

    <div class="preferences-item right">
      <div class="content">
        <ElButton @click="onSave">保存</ElButton>
      </div>
    </div>
    

  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
// import {useAppStore} from '../../store/app';
import { useI18n } from 'vue-i18n';
import { ElSelect, ElOption, ElInput, ElButton } from 'element-plus';
import { getConfig, save } from '../../api/preferences';

// const appStore=useAppStore();
const { t, locale } = useI18n();

const saveType = ref('default');


const path = ref('');

const options = ref([
  {
    label: t('default'),
    value: 'default'
  },
  {
    label: t('sepc'),
    value: 'sepc'
  },
  {
    label: 'PicGo',
    value: 'picgo'
  }
]);

const loadOptions = () => {
  options.value = [
    {
      label: t('default'),
      value: 'default'
    },
    {
      label: t('sepc'),
      value: 'sepc'
    },
    {
      label: 'picgo',
      value: 'picgo'
    }
  ];
}

watch(() => locale.value, () => {
  loadOptions();
})


onMounted(async () => {
  const resp = await getConfig() as any;
  if (resp.code === 0) {
    saveType.value = resp.data.image_save_type || 'default';
    path.value = resp.data.image_save_path || 'default';
  }
})

const onChange = (value: any) => {
  if (value === 'picgo') {
    path.value = 'http://127.0.0.1:36677/upload';
  }else if(value==='default'){
    path.value = '${filename}.assets';
  }
}

const onChangePath = () => {

}

const onSave = async () => {
  if(saveType.value==='spec'&&path.value.trim()===''){
    alert('必须指定路径');
    return;
  }
  let reps = await save(saveType.value, path.value);
  console.log('save', reps);
}

</script>
<style lang="scss">
.preferences-image {}
</style>
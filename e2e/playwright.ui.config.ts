import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./ui', testMatch:'**/*.spec.ts',globalSetup:'./ui/global-setup.ts',
 workers:1,retries:0,reporter:'list',outputDir:'/tmp/toktickit-issue9-ui-results',
 use:{trace:'retain-on-failure'},
 projects:[
  {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
  {name:'tablet',use:{...devices['Desktop Chrome'],viewport:{width:768,height:1000}}},
  {name:'mobile',use:{...devices['Desktop Chrome'],viewport:{width:375,height:1000}}},
 ],
});

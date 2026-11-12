import fs from 'node:fs/promises';
const required=['R2_BUCKET_NAME','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN'];
const missing=required.filter(key=>!process.env[key]);if(missing.length)throw Error('Set GitHub production environment configuration: '+missing.join(', '));
if(!/^[a-z0-9][-a-z0-9]{1,61}[a-z0-9]$/.test(process.env.R2_BUCKET_NAME))throw Error('Invalid R2 bucket name');
const config={name:'cardsteam',main:'dist/server/index.js',compatibility_date:'2026-10-01',workers_dev:true,preview_urls:false,vars:{AUTH_MODE:'game'},r2_buckets:[{binding:'BUCKET',bucket_name:process.env.R2_BUCKET_NAME}]};
await fs.writeFile('wrangler.deploy.json',JSON.stringify(config,null,2)+'\n');console.log('Worker configuration ready. NALMUK game accounts enabled; secret values are not written.');

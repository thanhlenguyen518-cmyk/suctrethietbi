import vinext from "vinext";
import {defineConfig} from "vite";
import {cloudflare} from "@cloudflare/vite-plugin";
export default defineConfig({plugins:[vinext(),cloudflare({viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},config:{name:"suctrethietbi",main:"./worker/index.ts",compatibility_date:"2026-05-15",compatibility_flags:["nodejs_compat"],d1_databases:[{binding:"DB",database_name:"suctre-db",database_id:"958d91b6-23b2-4fd9-a4e4-30a66166b569"}],vars:{PUBLIC_DEMO:"true",SCHEDULER_ENABLED:"false"}}})]});

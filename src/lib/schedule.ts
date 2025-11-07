import { SchedulerClient } from '@aws-sdk/client-scheduler';

export const isOffline = process.env.IS_OFFLINE === 'true';

const schedulerConfig = isOffline
  ? {
      region: process.env.AWS_REGION || "ap-southeast-1",
      endpoint: 'http://localhost:8001',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
      },
    }
  : {};

export const schedulerClient = new SchedulerClient(schedulerConfig);

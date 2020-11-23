#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AeorefComStack } from '../lib/aeoref.com-stack';

const app = new cdk.App();
new AeorefComStack(app, 'AeorefComStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'ap-northeast-1'
    }
});

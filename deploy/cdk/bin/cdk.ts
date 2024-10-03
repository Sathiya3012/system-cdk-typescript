#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CustomWebAclStack } from '../lib/web-acl-stack';
import { CustomAmplifyDistributionStack } from '../lib/amplify_add_on_stack';

const app = new cdk.App();

// new CustomWebAclStack(app, 'CustomWebAclStack', {
//   env: { "region": "us-east-1" },
// });

new CustomAmplifyDistributionStack(app, `CustomAmplifyDistributionStack-${app.node.tryGetContext('branch_name')}`, {
  webAclArn: app.node.tryGetContext("web_acl_arn"),
  appId: app.node.tryGetContext("app_id"),
  branchName: app.node.tryGetContext("branch_name"),
});
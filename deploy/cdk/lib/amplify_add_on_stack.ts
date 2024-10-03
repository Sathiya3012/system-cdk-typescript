import * as path from 'path';
import { Construct } from 'constructs';
import {
  Stack,
  StackProps,
  Aws,
  CfnOutput,
  Duration,
} from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as custom from 'aws-cdk-lib/custom-resources';

interface CustomAmplifyDistributionStackProps extends StackProps {
  webAclArn: string;
  appId: string;
  branchName: string;
}

export class CustomAmplifyDistributionStack extends Stack {
  public readonly amplifyAppDistribution: cloudfront.Distribution;

  constructor(
    scope: Construct,
    id: string,
    props: CustomAmplifyDistributionStackProps
  ) {
    super(scope, id, props);

    const { webAclArn, appId, branchName } = props;

    // Lambda Basic Execution Permissions
    const lambdaExecPolicy = iam.ManagedPolicy.fromManagedPolicyArn(
      this,
      'lambda-exec-policy-00',
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
    );

    const appBranchUpdate = new custom.AwsCustomResource(this, 'rAmplifyAppBranchUpdate', {
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          `arn:aws:amplify:${Aws.REGION}:${Aws.ACCOUNT_ID}:apps/${appId}/branches/${encodeURIComponent(branchName)}`
        ],
      }),
      onCreate: {
        service: 'Amplify',
        action: 'updateBranch',
        parameters: {
          appId,
          branchName,
          enableBasicAuth: false,
        },
        physicalResourceId: custom.PhysicalResourceId.of('amplify-branch-update'),
      },
      onUpdate: {
        service: 'Amplify',
        action: 'updateBranch',
        parameters: {
          appId,
          branchName,
          enableBasicAuth: false,
        },
        physicalResourceId: custom.PhysicalResourceId.of('amplify-branch-update'),
      },
    });

    // Format amplify branch
    const formattedAmplifyBranch = branchName.replace(/\//g, '-');

    // Define CloudFront distribution
    const amplifyAppDistribution = new cloudfront.Distribution(this, `rCustomCloudFrontDistribution--${branchName}`, {
      defaultBehavior: {
        origin: new origins.HttpOrigin(`${formattedAmplifyBranch}.${appId}.amplifyapp.com`),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      webAclId: webAclArn,
    });

    this.amplifyAppDistribution = amplifyAppDistribution;

    // CloudFront cache invalidation Lambda Execution Role
    const cacheInvalidationFunctionRole = new iam.Role(this, `rCacheInvalidationFunctionCustomRole--${branchName}`, {
      description: 'Role used by cache_invalidation lambda function',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    cacheInvalidationFunctionRole.addManagedPolicy(lambdaExecPolicy);

    const cacheInvalidationFunctionCustomPolicy = new iam.ManagedPolicy(this, `rCacheInvalidationFunctionCustomPolicy--${branchName}`, {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cloudfront:CreateInvalidation'],
          resources: [
            `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${amplifyAppDistribution.distributionId}`
          ],
        }),
      ],
    });

    cacheInvalidationFunctionRole.addManagedPolicy(cacheInvalidationFunctionCustomPolicy);

    // Function to trigger CloudFront invalidation
    const cacheInvalidationFunction = new lambda.Function(this, `rCacheInvalidationFunction--${branchName}`, {
      description: 'Custom function to trigger CloudFront cache invalidation',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'functions/cache_invalidation')),
      timeout: Duration.seconds(30),
      memorySize: 128,
      role: cacheInvalidationFunctionRole,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.SIX_MONTHS,
      environment: {
        DISTRIBUTION_ID: amplifyAppDistribution.distributionId,
      },
    });

    new events.Rule(this, `rInvokeCacheInvalidation--${branchName}`, {
      description: 'Rule is triggered when the Amplify app is redeployed, which creates a CloudFront cache invalidation request',
      eventPattern: {
        source: ['aws.amplify'],
        detailType: ['Amplify Deployment Status Change'],
        detail: {
          appId: [appId],
          branchName: [branchName],
          jobStatus: ['SUCCEED'],
        },
      },
      targets: [new targets.LambdaFunction(cacheInvalidationFunction, { retryAttempts: 2 })],
    });

    new CfnOutput(this, `oCloudFrontDistributionDomain--${branchName}`, {
      value: amplifyAppDistribution.distributionDomainName,
    });
  }
}
